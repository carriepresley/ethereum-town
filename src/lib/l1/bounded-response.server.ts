/** Limits apply to each upstream response, including its decoded body stream. */
export const UPSTREAM_RESPONSE_LIMITS = {
  telemetry: 2 * 1024 * 1024,
  bridges: 4 * 1024 * 1024,
  staking: 4 * 1024 * 1024,
  historical: 8 * 1024 * 1024,
} as const

/**
 * Content-Length is only an early check: compressed or dishonest responses can
 * deliver more bytes. Count every streamed byte before retaining it.
 * Fetch timeouts remain responsible for sources that stall without sending data.
 */
export async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('Invalid upstream response byte limit')

  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    // Do not let an upstream cancellation hook delay rejection of an unsafe body.
    void response.body?.cancel().catch(() => {})
    throw new Error(/^\d+$/.test(declaredLength)
      ? 'Upstream response exceeds the byte limit'
      : 'Upstream response has an invalid Content-Length')
  }

  if (!response.body) return ''
  const reader = response.body.getReader()
  // A growing contiguous buffer also bounds bookkeeping for tiny/empty chunks.
  let buffer = new Uint8Array(Math.min(16_384, maxBytes))
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const nextBytes = bytes + value.byteLength
      if (nextBytes > maxBytes) throw new Error('Upstream response exceeds the byte limit')
      if (nextBytes > buffer.length) {
        const grown = new Uint8Array(Math.min(maxBytes, Math.max(nextBytes, buffer.length * 2)))
        grown.set(buffer.subarray(0, bytes))
        buffer = grown
      }
      buffer.set(value, bytes)
      bytes = nextBytes
    }
    return new TextDecoder().decode(buffer.subarray(0, bytes))
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

export async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const text = await readBoundedText(response, maxBytes)
  try {
    return JSON.parse(text) as unknown
  } catch {
    // JSON.parse errors can quote source content; keep upstream bodies out of logs.
    throw new Error('Upstream response is not valid JSON')
  }
}
