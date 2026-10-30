import type { IError } from '../lib/error-handler'
import type { UseRequestOptions } from '../models/types'
import { useDataTimestamp } from '~/shared/composables/use-data-timestamp'
import { createApiErrorHandler } from '../lib/error-handler'
import { getDatabaseService } from '../lib/service'
import { useRequestStore } from '../store/request.store'

const pendingPromises = new Map<string, Promise<any | null>>()

type NormalizedRequestOptions<T> = Omit<UseRequestOptions<T>, 'initialData' | 'force' | 'cache' | 'cancelPrevious' | 'abortOnUnmount' | 'onError'> & {
  initialData: T | null
  force: boolean
  cache: boolean
  cancelPrevious: boolean
  abortOnUnmount: boolean
  onError: NonNullable<UseRequestOptions<T>['onError']>
}

function normalizeRequestOptions<T>(options: UseRequestOptions<T>, defaultErrorHandler: ReturnType<typeof createApiErrorHandler>): NormalizedRequestOptions<T> {
  return {
    ...options,
    initialData: options.initialData ?? null,
    force: options.force ?? true,
    cache: options.cache ?? false,
    cancelPrevious: options.cancelPrevious ?? true,
    abortOnUnmount: options.abortOnUnmount ?? false,
    onError: options.onError ?? ((error: unknown) => defaultErrorHandler({ error: error as IError })),
  }
}

function getServerErrorMessage(error: any): string | null {
  const responseData = error.response?.data || error.data

  if (Array.isArray(responseData) && responseData[0]?.error?.message)
    return responseData[0].error.message

  if (responseData?.error?.message)
    return responseData.error.message

  return null
}

async function handleRequestFailure(
  error: any,
  key: string,
  store: ReturnType<typeof useRequestStore>,
  onAbort: UseRequestOptions<unknown>['onAbort'],
  onError: NonNullable<UseRequestOptions<unknown>['onError']>,
): Promise<void> {
  if (error.name === 'AbortError') {
    store.setStatus(key, 'aborted')
    await onAbort?.()

    return
  }

  const serverMessage = getServerErrorMessage(error)
  const displayMessage = serverMessage || error.message || 'Произошла ошибка'

  store.setError(key, displayMessage)
  store.setStatus(key, 'error')
  console.error(`[useRequest Error] (key: ${key}):`, displayMessage)

  error.customMessage = displayMessage
  await onError({ error })
}

function recordRequestTimestamp(key: string, touch: (key: string) => void, peek: (key: string) => void): void {
  if (navigator.onLine)
    touch(key)
  else
    peek(key)
}

export async function useRequest<T>(options: UseRequestOptions<T>): Promise<T | null> {
  const defaultErrorHandler = createApiErrorHandler()
  const { touch, peek } = useDataTimestamp()
  const normalizedOptions = normalizeRequestOptions(options, defaultErrorHandler)
  const {
    key,
    fn,
    initialData,
    onSuccess,
    onError,
    onAbort,
    force,
    cache,
    cancelPrevious,
    abortOnUnmount,
  } = normalizedOptions

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

      recordRequestTimestamp(key, touch, peek)

      await onSuccess?.(result)

      return result
    }
    catch (e: any) {
      await handleRequestFailure(
        e,
        key,
        store,
        onAbort,
        onError,
      )

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
