import type { IError } from '../lib/error-handler'
import type { UseRequestOptions } from '../models/types'
import { getErrorMessage, getErrorStatus, isRecord } from '@injurka/type-utils'
import { useDataTimestamp } from '~/shared/composables/use-data-timestamp'
import { createApiErrorHandler } from '../lib/error-handler'
import { getDatabaseService } from '../lib/service'
import { useRequestStore } from '../store/request.store'

const pendingPromises = new Map<string, Promise<unknown | null>>()

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
    onError: options.onError ?? defaultErrorHandler,
  }
}

function getServerErrorMessage(error: unknown): string | null {
  if (!isRecord(error))
    return null

  const response = isRecord(error.response) ? error.response : undefined
  const data = response?.data ?? error.data
  const first = Array.isArray(data) ? data[0] : data

  if (isRecord(first) && isRecord(first.error) && typeof first.error.message === 'string')
    return first.error.message

  return null
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key]

  return typeof field === 'string' ? field : undefined
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key]

  return typeof field === 'number' ? field : undefined
}

function normalizeApiError(error: unknown, customMessage: string): IError {
  const value = isRecord(error) ? error : {}
  const data = isRecord(value.data) ? value.data : {}
  const shape = isRecord(value.shape) ? value.shape : {}
  const shapeData = isRecord(shape.data) ? shape.data : {}

  return {
    message: getErrorMessage(error),
    customMessage,
    statusCode: getErrorStatus(error),
    data: {
      httpStatus: readNumber(data, 'httpStatus'),
      code: readString(data, 'code'),
      description: readString(data, 'description'),
      message: readString(data, 'message'),
    },
    shape: {
      message: typeof shape.message === 'string' ? shape.message : customMessage,
      data: {
        httpStatus: readNumber(shapeData, 'httpStatus'),
        code: readString(shapeData, 'code'),
      },
    },
  }
}

async function handleRequestFailure(
  error: unknown,
  key: string,
  store: ReturnType<typeof useRequestStore>,
  onAbort: UseRequestOptions<unknown>['onAbort'],
  onError: NonNullable<UseRequestOptions<unknown>['onError']>,
): Promise<void> {
  if (error instanceof Error && error.name === 'AbortError') {
    store.setStatus(key, 'aborted')
    await onAbort?.()

    return
  }

  const serverMessage = getServerErrorMessage(error)
  const displayMessage = serverMessage || getErrorMessage(error, 'Произошла ошибка')

  store.setError(key, displayMessage)
  store.setStatus(key, 'error')
  console.error(`[useRequest Error] (key: ${key}):`, displayMessage)

  await onError({ error: normalizeApiError(error, displayMessage) })
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
    return pendingPromises.get(key)! as Promise<T | null>

  if (cache && !force && store.statuses.get(key) === 'success' && store.cache.has(key)) {
    peek(key)
    const cached = toRaw(store.cache.get(key)) as T
    await onSuccess?.(cached)

    return cached
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
    catch (e) {
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
