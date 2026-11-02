import { getErrorMessage, getErrorStatus, isRecord } from '@injurka/type-utils'
import { useAuthStore } from '~/shared/store/auth.store'

let refreshingPromise: Promise<boolean> | null = null

/**
 * Гарантирует наличие валидного токена или выполняет refresh токена.
 * Если несколько запросов вызывают эту функцию одновременно,
 * выполняется только один реальный сетевой запрос на refresh.
 */
export async function refreshTokensIfNeeded(): Promise<boolean> {
  const authStore = useAuthStore()
  const refreshToken = authStore.tokenPair?.refreshToken

  if (!refreshToken) {
    authStore.clearAuth()

    return false
  }

  if (!refreshingPromise) {
    refreshingPromise = (async () => {
      try {
        await authStore.refresh()

        return true
      }
      catch {
        authStore.clearAuth()

        return false
      }
    })().finally(() => {
      refreshingPromise = null
    })
  }

  return refreshingPromise
}

function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error))
    return undefined

  const data = isRecord(error.data) ? error.data : undefined
  const shape = isRecord(error.shape) ? error.shape : undefined
  const shapeData = isRecord(shape?.data) ? shape.data : undefined
  const code = data?.code ?? shapeData?.code

  return typeof code === 'string' ? code : undefined
}

function hasUnauthorizedMessage(message: string): boolean {
  return message.includes('Not authenticated')
    || message.includes('401')
    || message.includes('UNAUTHORIZED')
}

export function isUnauthorizedError(err: unknown): boolean {
  if (!err)
    return false

  const code = getErrorCode(err)
  const httpStatus = getErrorStatus(err)
  const message = getErrorMessage(err)

  return (
    code === 'UNAUTHORIZED'
    || httpStatus === 401
    || hasUnauthorizedMessage(message)
  )
}
