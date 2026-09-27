type CompletedCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
  delete(request: Request): Promise<boolean>
}
type PublicFeedCacheOptions<T> = {
  requestUrl: string
  key: string
  ttlSeconds: number
  load: () => Promise<T>
  timestamp: (value: T) => string
  cacheable: (value: T) => boolean
}

const PUBLIC_FEEDS: Readonly<Record<string, number>> = Object.freeze({
  'telemetry-10-networks': 12,
  'selected-bridges': 12,
  'reported-staking': 900,
  'ethereum-stablecoin-supply': 60,
  'ethereum-health': 12,
})
export const NODE_PUBLIC_CACHE_LIMITS = Object.freeze({entries: 12, entryBytes: 1_048_576, totalBytes: 4_194_304})

/** A process-local, bounded store of completed JSON strings, never requests or promises. */
export function createNodeCompletedCache(): CompletedCache {
  const entries = new Map<string, {json: string; expiresAt: number; bytes: number}>()
  let totalBytes = 0
  const remove = (key: string) => {
    const entry = entries.get(key)
    if (!entry) return false
    totalBytes -= entry.bytes
    return entries.delete(key)
  }
  const prune = () => {
    const now = Date.now()
    for (const [key, entry] of entries) if (entry.expiresAt <= now) remove(key)
  }
  return {
    async match(request) {
      prune()
      const entry = entries.get(request.url)
      if (!entry) return undefined
      // Move to the end for bounded least-recently-used eviction.
      entries.delete(request.url)
      entries.set(request.url, entry)
      return new Response(entry.json, {headers: {'Content-Type': 'application/json'}})
    },
    async put(request, response) {
      const json = await response.text()
      const bytes = new TextEncoder().encode(json).byteLength
      if (bytes > NODE_PUBLIC_CACHE_LIMITS.entryBytes) return
      const saved = JSON.parse(json) as {expiresAt?: number}
      const now = Date.now()
      if (typeof saved.expiresAt !== 'number' || !Number.isFinite(saved.expiresAt)
        || saved.expiresAt <= now || saved.expiresAt > now + 900_000) return
      prune()
      remove(request.url)
      while (entries.size >= NODE_PUBLIC_CACHE_LIMITS.entries || totalBytes + bytes > NODE_PUBLIC_CACHE_LIMITS.totalBytes) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        remove(oldest)
      }
      entries.set(request.url, {json, expiresAt: saved.expiresAt, bytes})
      totalBytes += bytes
    },
    async delete(request) { return remove(request.url) },
  }
}
const nodeCompletedCache = createNodeCompletedCache()

/** Only completed public JSON is shared; all in-flight work remains request-scoped. */
export async function publicFeedCache<T>(options: PublicFeedCacheOptions<T>): Promise<T> {
  const maximumTtl = Object.hasOwn(PUBLIC_FEEDS, options.key) ? PUBLIC_FEEDS[options.key] : undefined
  if (maximumTtl === undefined || !Number.isFinite(options.ttlSeconds)
    || options.ttlSeconds <= 0 || options.ttlSeconds > maximumTtl) return options.load()
  const cache = (globalThis as unknown as {caches?: {default?: CompletedCache}}).caches?.default ?? nodeCompletedCache
  const request = new Request(new URL('/__public-feed-cache/v3/' + encodeURIComponent(options.key), options.requestUrl))
  const ttlMs = options.ttlSeconds * 1000
  try {
    const response = await cache.match(request)
    if (response) {
      const saved = await response.json() as {version?: number; expiresAt?: number; value?: T}
      const now = Date.now()
      if (saved.version === 1 && saved.value !== undefined && typeof saved.expiresAt === 'number') {
        const sourceTime = Date.parse(options.timestamp(saved.value))
        if (Number.isFinite(sourceTime) && sourceTime <= now && now - sourceTime < ttlMs
          && saved.expiresAt > now && saved.expiresAt <= sourceTime + ttlMs
          && options.cacheable(saved.value)) return saved.value
      }
      await cache.delete(request)
    }
  } catch { /* A cache failure is a miss, never a reason to manufacture a successful feed. */ }

  const value = await options.load()
  try {
    const now = Date.now()
    const sourceTime = Date.parse(options.timestamp(value))
    const expiresAt = sourceTime + ttlMs
    if (options.cacheable(value) && Number.isFinite(sourceTime) && sourceTime <= now && expiresAt > now) {
      const response = Response.json({version: 1, expiresAt, value}, {
        headers: {'Cache-Control': 'public, max-age=' + Math.max(1, Math.floor((expiresAt - now) / 1000))},
      })
      await cache.put(request, response)
    }
  } catch { /* Valid observations remain usable if the optional cache cannot be written. */ }
  return value
}
