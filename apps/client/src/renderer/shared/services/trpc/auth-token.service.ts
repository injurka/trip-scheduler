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

export function isUnauthorizedError(err: any): boolean {
  if (!err)
    return false
  const code = err.data?.code || err.shape?.data?.code
  const httpStatus = err.data?.httpStatus || err.shape?.data?.httpStatus || err.status || err.statusCode
  const message = typeof err.message === 'string' ? err.message : ''

  return (
    code === 'UNAUTHORIZED'
    || httpStatus === 401
    || message.includes('Not authenticated')
    || message.includes('401')
    || message.includes('UNAUTHORIZED')
  )
}
