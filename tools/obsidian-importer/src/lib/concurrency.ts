/**
 * Concurrency helper for running asynchronous tasks with a concurrency limit.
 */
export async function pMap<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  if (items.length === 0)
    return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results: R[] = Array.from({ length: items.length })
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await mapper(items[current], current)
    }
  }

  const workers = Array.from({ length: limit }, () => worker())
  await Promise.all(workers)
  return results
}
