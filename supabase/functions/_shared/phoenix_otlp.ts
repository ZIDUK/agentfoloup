/**
 * Minimal OTLP/HTTP protobuf for Arize Phoenix (/v1/traces, application/x-protobuf).
 * Raw wire format + fetch — works on Deno Edge. Import from any function:
 *   import { buildPhoenixLlmTraceBody, sendPhoenixOtlp } from "../_shared/phoenix_otlp.ts"
 */

const LOG = "[phoenix][otlp]"

declare const Deno: { env: { get(key: string): string | undefined } }

function concat(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function writeVarint(n: number): Uint8Array {
  const bytes: number[] = []
  let x = n >>> 0
  while (x >= 0x80) {
    bytes.push((x & 0x7f) | 0x80)
    x >>>= 7
  }
  bytes.push(x)
  return new Uint8Array(bytes)
}

function tag(field: number, wire: 0 | 1 | 2 | 5): Uint8Array {
  return writeVarint((field << 3) | wire)
}

function encodeStringField(field: number, s: string): Uint8Array {
  const u8 = new TextEncoder().encode(s)
  return concat(tag(field, 2), writeVarint(u8.length), u8)
}

function encodeBytesField(field: number, b: Uint8Array): Uint8Array {
  return concat(tag(field, 2), writeVarint(b.length), b)
}

function encodeVarintField(field: number, n: number): Uint8Array {
  return concat(tag(field, 0), writeVarint(n))
}

function encodeFixed64Field(field: number, ns: bigint): Uint8Array {
  const b = new Uint8Array(8)
  let v = ns
  for (let i = 0; i < 8; i++) {
    b[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return concat(tag(field, 1), b)
}

function embed(field: number, inner: Uint8Array): Uint8Array {
  return concat(tag(field, 2), writeVarint(inner.length), inner)
}

function keyValueString(key: string, val: string): Uint8Array {
  const anyBody = encodeStringField(1, val)
  return concat(encodeStringField(1, key), embed(2, anyBody))
}

function keyValueInt(key: string, val: number): Uint8Array {
  const anyBody = encodeVarintField(3, val)
  return concat(encodeStringField(1, key), embed(2, anyBody))
}

function keyValueDouble(key: string, val: number): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setFloat64(0, val, true)
  const anyBody = concat(tag(4, 1), b)
  return concat(encodeStringField(1, key), embed(2, anyBody))
}

function keyValueBool(key: string, val: boolean): Uint8Array {
  const anyBody = encodeVarintField(2, val ? 1 : 0)
  return concat(encodeStringField(1, key), embed(2, anyBody))
}

function resource(attrs: Uint8Array[]): Uint8Array {
  if (attrs.length === 0) return new Uint8Array(0)
  return concat(...attrs.map((kv) => embed(1, kv)))
}

function instrumentationScope(name: string, version: string): Uint8Array {
  return concat(encodeStringField(1, name), encodeStringField(2, version))
}

function statusOk(): Uint8Array {
  return encodeVarintField(3, 1)
}

function statusErr(msg: string): Uint8Array {
  return concat(encodeStringField(2, msg), encodeVarintField(3, 2))
}

function span(params: {
  traceId: Uint8Array
  spanId: Uint8Array
  parentSpanId?: Uint8Array
  name: string
  kind: number
  startNs: bigint
  endNs: bigint
  attributes: Uint8Array[]
  status: Uint8Array
}): Uint8Array {
  if (params.traceId.length !== 16 || params.spanId.length !== 8) {
    throw new Error("traceId must be 16 bytes, spanId 8 bytes")
  }
  let s = concat(
    encodeBytesField(1, params.traceId),
    encodeBytesField(2, params.spanId),
  )
  if (params.parentSpanId && params.parentSpanId.length === 8) {
    const nonZero = params.parentSpanId.some((b) => b !== 0)
    if (nonZero) s = concat(s, encodeBytesField(4, params.parentSpanId))
  }
  s = concat(
    s,
    encodeStringField(5, params.name),
    encodeVarintField(6, params.kind),
    encodeFixed64Field(7, params.startNs),
    encodeFixed64Field(8, params.endNs),
  )
  for (const kv of params.attributes) {
    s = concat(s, embed(9, kv))
  }
  s = concat(s, embed(15, params.status))
  return s
}

export function randomTraceId(): Uint8Array {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return b
}

export function randomSpanId(): Uint8Array {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return b
}

/** One CHAIN root + one LLM child; same shape as improve-text-ai (any function can pass its own names). */
export function buildPhoenixLlmTraceBody(params: {
  /** Resource attribute service.name */
  serviceName: string
  /** openinference.project.name */
  projectName: string
  rootSpanName: string
  llmSpanName: string
  /** InstrumentationScope name (often same as serviceName) */
  scopeName: string
  scopeVersion?: string
  /** Optional tag on both spans, e.g. field type */
  fieldType?: string
  model: string
  promptPreview: string
  outputPreview: string
  promptLen: number
  outputLen: number
  temperature: number
  maxOutputTokens: number
  tokenPrompt?: number
  tokenCompletion?: number
  tokenTotal?: number
  rootStartMs: number
  rootEndMs: number
  llmStartMs: number
  llmEndMs: number
  /** Error message from the LLM call, if any. */
  llmError?: string
}): Uint8Array {
  const traceId = randomTraceId()
  const rootSpanId = randomSpanId()
  const llmSpanId = randomSpanId()
  const scopeVersion = params.scopeVersion ?? "1.0.0"

  const msToNs = (ms: number) => BigInt(ms) * 1_000_000n

  const denoEnv = (typeof Deno !== "undefined" ? Deno.env.get("DENO_ENV") : undefined) ?? ""
  const environment = denoEnv === "development" ? "LOCAL" : "PROD"
  const rootSpanName = `[${environment}] ${params.rootSpanName}`

  const resAttrs = [
    keyValueString("service.name", params.serviceName),
    keyValueString("openinference.project.name", params.projectName),
    keyValueString("deployment.environment", environment),
  ]
  const resBody = resource(resAttrs)

  const rootAttrs: Uint8Array[] = [
    keyValueString("openinference.span.kind", "CHAIN"),
    keyValueString("input.mime_type", "text/plain"),
    keyValueString("output.mime_type", "text/plain"),
    keyValueString("input.value", params.promptPreview),
    keyValueString("output.value", params.outputPreview),
    keyValueInt("input.length", params.promptLen),
    keyValueInt("output.length", params.outputLen),
    keyValueString("deployment.environment", environment),
  ]
  if (params.fieldType) {
    rootAttrs.push(keyValueString("field.type", params.fieldType))
  }

  const effectiveError = params.llmError

  const llmAttrs: Uint8Array[] = [
    keyValueString("openinference.span.kind", "LLM"),
    keyValueString("llm.provider", "aws"),
    keyValueString("llm.model_name", params.model),
    keyValueDouble("llm.temperature", params.temperature),
    keyValueInt("llm.max_output_tokens", params.maxOutputTokens),
    keyValueString("input.mime_type", "text/plain"),
    keyValueString("output.mime_type", "text/plain"),
    keyValueString("input.value", params.promptPreview),
    keyValueString("output.value", params.outputPreview),
  ]
  if (params.fieldType) {
    llmAttrs.push(keyValueString("field.type", params.fieldType))
  }
  if (params.tokenPrompt != null) llmAttrs.push(keyValueInt("llm.token_count.prompt", params.tokenPrompt))
  if (params.tokenCompletion != null) {
    llmAttrs.push(keyValueInt("llm.token_count.completion", params.tokenCompletion))
  }
  if (params.tokenTotal != null) llmAttrs.push(keyValueInt("llm.token_count.total", params.tokenTotal))
  if (effectiveError) {
    llmAttrs.push(keyValueString("error.message", effectiveError))
    llmAttrs.push(keyValueBool("error", true))
  }

  const rootSpan = span({
    traceId,
    spanId: rootSpanId,
    name: rootSpanName,
    kind: 1,
    startNs: msToNs(params.rootStartMs),
    endNs: msToNs(params.rootEndMs),
    attributes: rootAttrs,
    status: effectiveError ? statusErr(effectiveError) : statusOk(),
  })

  const llmSpan = span({
    traceId,
    spanId: llmSpanId,
    parentSpanId: rootSpanId,
    name: params.llmSpanName,
    kind: 3,
    startNs: msToNs(params.llmStartMs),
    endNs: msToNs(params.llmEndMs),
    attributes: llmAttrs,
    status: effectiveError ? statusErr(effectiveError) : statusOk(),
  })

  const scope = instrumentationScope(params.scopeName, scopeVersion)
  const scopeSpansBody = concat(
    embed(1, scope),
    embed(2, rootSpan),
    embed(2, llmSpan),
  )

  const resourceSpansBody = concat(embed(1, resBody), embed(2, scopeSpansBody))
  return embed(1, resourceSpansBody)
}

export async function sendPhoenixOtlp(
  baseUrl: string,
  body: Uint8Array,
): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/traces`
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-protobuf" },
      body: body.slice(),
    })
    const detail = await res.text()
    const ms = Date.now() - t0
    if (!res.ok) {
      console.error(`${LOG} POST ${url} -> ${res.status} in ${ms}ms`, detail.slice(0, 400))
      return { ok: false, status: res.status, detail: detail.slice(0, 500) }
    }
    console.log(`${LOG} POST ${url} -> ${res.status} in ${ms}ms (body len=${body.length})`)
    return { ok: true, status: res.status, detail: detail.slice(0, 200) }
  } catch (e) {
    console.error(`${LOG} fetch failed:`, e)
    return { ok: false, status: 0, detail: e instanceof Error ? e.message : String(e) }
  }
}
