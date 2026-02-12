import type { IError } from '../lib/error-handler'
import type { UseRequestOptions } from '../models/types'
import { useDataTimestamp } from '~/shared/composables/use-data-timestamp'
import { createApiErrorHandler } from '../lib/error-handler'
import { getDatabaseService } from '../lib/service'
import { useRequestStore } from '../store/request.store'

const pendingPromises = new Map<string, Promise<any | null>>()

export async function useRequest<T>(
  options: UseRequestOptions<T>,
): Promise<T | null> {
  const defaultErrorHandler = createApiErrorHandler()
  const { touch, peek } = useDataTimestamp()

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
    peek(key)
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

      if (navigator.onLine) {
        touch(key)
      }
      else {
        peek(key)
      }

      await onSuccess?.(result)
      return result
    }
    catch (e: any) {
      if (e.name === 'AbortError') {
        store.setStatus(key, 'aborted')
        await onAbort?.()
      }
      else {
        const responseData = e.response?.data || e.data

        let serverMessage = null

        if (Array.isArray(responseData) && responseData[0]?.error?.message) {
          serverMessage = responseData[0].error.message
        }
        else if (responseData?.error?.message) {
          serverMessage = responseData.error.message
        }

        const displayMessage = serverMessage || e.message || 'Произошла ошибка'

        store.setError(key, displayMessage)
        store.setStatus(key, 'error')

        console.error(`[useRequest Error] (key: ${key}):`, displayMessage)

        e.customMessage = displayMessage
        await onError?.({ error: e })
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
