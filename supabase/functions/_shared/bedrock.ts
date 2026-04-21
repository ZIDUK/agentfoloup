/**
 * AWS Bedrock client for Supabase Edge Functions (Deno).
 *
 * Drop-in replacement for the per-function callGemini() implementations.
 * Uses the Bedrock Converse API (model-agnostic, supports all foundation models)
 * with AWS Signature V4 via aws4fetch.
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION           (default: us-east-1)
 *
 * Model IDs are hardcoded per-function — not read from env.
 *
 * JSON schema enforcement:
 *   When responseSchema is provided, Bedrock's tool-use feature forces the model
 *   to return a JSON object matching the schema exactly — equivalent to Gemini's
 *   responseMimeType:"application/json" + responseSchema combination.
 *   The output is serialised back to a JSON string so callers get the same
 *   `{ text, usage }` shape regardless of mode.
 */

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BedrockUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type BedrockConfig = {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

export type BedrockCallOptions = {
  /** System-level instruction prepended as a system turn. */
  systemPrompt?: string
  /** Sampling temperature. Default: 0.3 */
  temperature?: number
  /** Maximum output tokens. Default: 1024 */
  maxTokens?: number
  /**
   * JSON Schema to enforce on the output.
   * When set, the model is constrained via tool-use to produce a JSON object
   * that satisfies this schema. The response .text will be a valid JSON string.
   */
  responseSchema?: Record<string, unknown>
}

export type BedrockResponse = {
  text: string
  usage?: BedrockUsage
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/**
 * Load Bedrock credentials from Deno env vars.
 * Throws a descriptive error if required vars are absent.
 */
export function getBedrockConfig(): BedrockConfig {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
  const region = Deno.env.get('AWS_REGION') ?? 'us-east-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required env vars: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set',
    )
  }

  return { accessKeyId, secretAccessKey, region }
}

// ---------------------------------------------------------------------------
// Core API call
// ---------------------------------------------------------------------------

/**
 * Invoke an AWS Bedrock foundation model via the Converse API.
 *
 * Converse API is model-agnostic — the same request shape works for Llama,
 * Mistral, Titan, Nova, and any other Bedrock-hosted model.
 *
 * @param config  AWS credentials and region
 * @param modelId Bedrock model ID (e.g. "openai.gpt-oss-safeguard-120b")
 * @param prompt  User message text
 * @param opts    Optional: system prompt, temperature, max tokens, response schema
 */
export async function callBedrock(
  config: BedrockConfig,
  modelId: string,
  prompt: string,
  opts?: BedrockCallOptions,
): Promise<BedrockResponse> {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 'bedrock',
  })

  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`

  const requestBody: Record<string, unknown> = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      temperature: opts?.temperature ?? 0.3,
      maxTokens: opts?.maxTokens ?? 1024,
    },
  }

  if (opts?.systemPrompt) {
    requestBody.system = [{ text: opts.systemPrompt }]
  }

  if (opts?.responseSchema) {
    // Force structured JSON output via tool-use.
    // toolChoice: { tool: { name: "json_output" } } guarantees the model
    // MUST call this tool, so the response is always schema-conformant JSON.
    requestBody.toolConfig = {
      tools: [
        {
          toolSpec: {
            name: 'json_output',
            description:
              'Output structured data. Return a JSON object that exactly matches the provided schema. ' +
              'No markdown, no code fences, no commentary — only the raw JSON object.',
            inputSchema: { json: opts.responseSchema },
          },
        },
      ],
      toolChoice: { tool: { name: 'json_output' } },
    }
  }

  const response = await aws.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Bedrock API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json() as {
    output?: {
      message?: {
        content?: Array<
          | { text: string }
          | { toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } }
        >
      }
    }
    usage?: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
    }
    stopReason?: string
  }

  let text = ''

  if (opts?.responseSchema) {
    // Schema-enforced: extract from toolUse block and re-serialize to JSON string.
    const toolUseBlock = data.output?.message?.content?.find(
      (c): c is { toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } } =>
        'toolUse' in c,
    )
    if (!toolUseBlock?.toolUse?.input) {
      throw new Error(
        `Bedrock returned no tool-use output for schema-enforced call (stopReason: ${data.stopReason ?? 'unknown'})`,
      )
    }
    text = JSON.stringify(toolUseBlock.toolUse.input)
  } else {
    // Free-text: extract from text block.
    const textBlock = data.output?.message?.content?.find(
      (c): c is { text: string } => 'text' in c,
    )
    text = textBlock?.text ?? ''
  }

  if (!text) {
    throw new Error(
      `Bedrock returned empty response (stopReason: ${data.stopReason ?? 'unknown'})`,
    )
  }

  const inputTokens = data.usage?.inputTokens ?? 0
  const outputTokens = data.usage?.outputTokens ?? 0

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: data.usage?.totalTokens ?? inputTokens + outputTokens,
    },
  }
}
