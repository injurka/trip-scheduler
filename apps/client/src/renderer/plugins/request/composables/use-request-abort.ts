import { useRequestStore } from '../store'

/**
 * Composable для отмены запросов по ключу.
 */
export function useAbortRequest() {
  const store = useRequestStore()

  return {
    abort: (key: string) => store.abort(key),
  }
}
