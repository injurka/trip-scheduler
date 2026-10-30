import type { Pinia } from 'pinia'
import { isNetworkOrServerError } from '~/shared/lib/error'
import { useAuthStore } from '~/shared/store/auth.store'

function restoreOfflineSessionIfAvailable(authStore: ReturnType<typeof useAuthStore>): boolean {
  if (typeof navigator === 'undefined' || navigator.onLine)
    return false

  if (authStore.tokenPair?.accessToken && authStore.user) {
    console.warn('Приложение оффлайн. Восстановлена кэшированная сессия.')

    return true
  }

  return false
}

async function restoreUserFromAvailableToken(authStore: ReturnType<typeof useAuthStore>): Promise<void> {
  if (authStore.tokenPair?.accessToken) {
    await authStore.me()

    return
  }

  if (authStore.tokenPair?.refreshToken) {
    await authStore.refresh()
    await authStore.me()
  }
}

async function retryWithRefreshToken(authStore: ReturnType<typeof useAuthStore>): Promise<void> {
  console.warn('Первоначальная попытка восстановления сессии не удалась, пробую обновить токен.')
  await authStore.refresh()
  await authStore.me()
}

async function recoverSessionAfterError(authStore: ReturnType<typeof useAuthStore>, error: unknown): Promise<void> {
  if (isNetworkOrServerError(error)) {
    console.warn('Сетевая ошибка при восстановлении сессии. Используем локальные данные.')

    return
  }

  if (!authStore.tokenPair?.refreshToken) {
    authStore.clearAuth()

    return
  }

  try {
    await retryWithRefreshToken(authStore)
  }
  catch (refreshError) {
    if (isNetworkOrServerError(refreshError)) {
      console.warn('Сетевая ошибка при обновлении токена. Используем локальные данные.')
    }
    else {
      console.error('Не удалось восстановить сессию даже после обновления токена:', refreshError)
      authStore.clearAuth()
    }
  }
}

/**
 * Плагин восстановления сессии.
 * Выполняется один раз при загрузке приложения.
 * @param pinia - Экземпляр Pinia.
 */
export async function restoreSession(pinia: Pinia): Promise<void> {
  const authStore = useAuthStore(pinia)

  if (authStore.isInitialized) {
    return
  }

  try {
    if (restoreOfflineSessionIfAvailable(authStore))
      return

    await restoreUserFromAvailableToken(authStore)
  }
  catch (error) {
    await recoverSessionAfterError(authStore, error)
  }
  finally {
    authStore.isInitialized = true
  }
}
