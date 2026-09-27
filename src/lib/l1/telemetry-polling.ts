type FeedTask<T> = {
  request: (signal: AbortSignal) => Promise<T>
  timeoutMs: number
  success: (value: T) => void
  failure: (error: unknown) => void
}

// Each feed has its own in-flight gate. Abandoned/late requests cannot publish.
export function createFeedPoller(changed: () => void = () => {}) {
  const pending = new Map<string, AbortController>()
  return {
    busy: (key: string) => pending.has(key),
    cancelAll() {
      const controllers = [...pending.values()]
      pending.clear()
      for (const controller of controllers) controller.abort()
    },
    async run<T>(key: string, task: FeedTask<T>): Promise<void> {
      if (pending.has(key)) return
      const controller = new AbortController()
      pending.set(key, controller)
      changed()
      let abortListener: () => void = () => {}
      const cancelled = new Promise<never>((_, reject) => {
        abortListener = () => reject(controller.signal.reason ?? new Error('Feed request cancelled'))
        controller.signal.addEventListener('abort', abortListener, { once: true })
      })
      const timer = setTimeout(() => controller.abort(new DOMException('Feed request timed out', 'TimeoutError')), task.timeoutMs)
      try {
        const result = await Promise.race([Promise.resolve().then(() => task.request(controller.signal)), cancelled])
        if (pending.get(key) === controller) task.success(result)
      } catch (error) {
        if (pending.get(key) === controller) task.failure(error)
      } finally {
        clearTimeout(timer)
        controller.signal.removeEventListener('abort', abortListener)
        if (pending.get(key) === controller) {
          pending.delete(key)
          changed()
        }
      }
    },
  }
}
