/**
 * Server-side helper for calling the llm-calls Supabase edge function.
 * Used by Next.js API routes and server actions.
 * Not safe for direct browser use — uses the service role key.
 */

export async function callLlmEdgeFunction<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown>,
): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/llm-calls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ action, data }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new Error(`llm-calls [${action}] error: ${err.error ?? response.status}`)
  }

  return response.json()
}
