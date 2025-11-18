import type { IError } from '../lib/error-handler'
import type { UseRequestOptions } from '../models/types'
import { createApiErrorHandler } from '../lib/error-handler'
import { getDatabaseService } from '../lib/service'
import { useRequestStore } from '../store/request.store'

const pendingPromises = new Map<string, Promise<any | null>>()

/**
 * Асинхронный composable для выполнения и кеширования запросов к базе данных.
 *
 * @param options - Объект с параметрами операции.
 * @returns Promise, который разрешается в данные запроса или null в случае ошибки.
 */
export async function useRequest<T>(
  options: UseRequestOptions<T>,
): Promise<T | null> {
  const defaultErrorHandler = createApiErrorHandler()

  const {
    key,
    fn,
    initialData = null,
    onSuccess,
    onError = (error: unknown) => defaultErrorHandler({ error: error as IError }),
    onAbort,
    force = true,
    cache = false,
    cancelPrevious = true,
    abortOnUnmount = false,
  } = options

  const store = useRequestStore()

  if (abortOnUnmount && getCurrentInstance()) {
    onUnmounted(() => {
      if (store.statuses.get(key) === 'pending')
        store.abort(key)
    })
  }

  if (!force && pendingPromises.has(key))
    return pendingPromises.get(key)!

  if (cache && !force && store.statuses.get(key) === 'success' && store.cache.has(key)) {
    await onSuccess?.(toRaw(store.cache.get(key)))

    return toRaw(store.cache.get(key))
  }

  const controller = new AbortController()

  const requestPromise = (async (): Promise<T | null> => {
    if (cancelPrevious)
      store.abort(key)

    store.controllers.set(key, controller)

    store.setStatus(key, 'pending')
    store.setError(key, null)

    try {
      const dbService = await getDatabaseService()
      const result = await fn(dbService, controller.signal)

      if (controller.signal.aborted)
        throw new DOMException('Aborted', 'AbortError')

      store.setCache(key, result)
      store.setStatus(key, 'success')
      await onSuccess?.(result)
      return result
    }
    catch (e: any) {
      if (e.name === 'AbortError') {
        store.setStatus(key, 'aborted')
        await onAbort?.()
      }
      else {
        store.setError(key, e)
        store.setStatus(key, 'error')
        console.error(`[useRequest Error] (key: ${key}):`, e)
        await onError?.(e)
      }
      return initialData
    }
    finally {
      pendingPromises.delete(key)
      if (store.controllers.get(key) === controller)
        store.controllers.delete(key)
    }
  })()

  pendingPromises.set(key, requestPromise)

  return requestPromise
}
