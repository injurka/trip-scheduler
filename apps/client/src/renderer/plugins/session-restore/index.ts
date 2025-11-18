import type { Pinia } from 'pinia'
import { useAuthStore } from '~/shared/store/auth.store'

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
    // Если есть access-токен, пытаемся получить пользователя
    if (authStore.tokenPair?.accessToken) {
      await authStore.me()
    }
    // Если access-токена нет, но есть refresh-токен, сразу обновляем
    else if (authStore.tokenPair?.refreshToken) {
      await authStore.refresh()
      await authStore.me()
    }
  }
  catch {
    // Если первая попытка не удалась (например, access-токен истек)
    // и у нас все еще есть refresh-токен (т.к. me() его больше не удаляет).
    if (authStore.tokenPair?.refreshToken) {
      try {
        console.warn('Первоначальная попытка восстановления сессии не удалась, пробую обновить токен.')
        await authStore.refresh()
        await authStore.me()
      }
      catch (refreshError) {
        // Если и обновление не помогло, то все очищаем
        console.error('Не удалось восстановить сессию даже после обновления токена:', refreshError)
        authStore.clearAuth()
      }
    }
    else {
      // Если refresh-токена нет, то просто очищаем
      authStore.clearAuth()
    }
  }
  finally {
    authStore.isInitialized = true
  }
}
