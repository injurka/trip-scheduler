import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useToastStore } from '~/shared/store/toast.store'
import { useAuthStore } from '../store/auth.store'
import { getAppBaseUrl, isTauri } from './env'

export const DEEP_LINK_SCHEME = 'trip-scheduler'

/**
 * Генерирует Deep Link для прямого открытия сущности в приложении (по схеме trip-scheduler://)
 */
export function getTripDeepLinkUrl(slugOrId: string): string {
  const clean = slugOrId.replace(/^\/+/, '')
  return `${DEEP_LINK_SCHEME}://trip/${clean}`
}

/**
 * Генерирует публичный веб-URL для открытия/шеринга в браузере или через App Links
 */
export function getTripWebUrl(slugOrId: string): string {
  const path = AppRoutePaths.Trip.Info(slugOrId)
  return new URL(path, getAppBaseUrl()).toString()
}

/**
 * Обрабатывает входящий deep link URI (например, trip-scheduler://trip/... или https://trip-scheduler.limited-dissolve.ru/trip/...)
 */
export async function handleDeepLinkUrl(rawUrl: string, pinia: Pinia, router: Router): Promise<void> {
  if (!rawUrl)
    return

  try {
    // В URL схемах вида trip-scheduler://auth/callback хост = auth, pathname = /callback
    // Нормализуем для парсинга через new URL
    let urlStr = rawUrl
    if (urlStr.startsWith(`${DEEP_LINK_SCHEME}://`)) {
      const pathPart = urlStr.replace(new RegExp(`^${DEEP_LINK_SCHEME}://`), '').replace(/^\/+/, '')
      urlStr = `http://localhost/${pathPart}`
    }

    const parsed = new URL(urlStr)
    const pathname = parsed.pathname
    const searchParams = parsed.searchParams

    const authStore = useAuthStore(pinia)
    const toastStore = useToastStore(pinia)

    // 1. Авторизация через OAuth callback
    if (pathname.includes('/auth/callback') || pathname.startsWith('/auth/callback')) {
      const token = searchParams.get('token')
      const refreshToken = searchParams.get('refreshToken') || undefined

      if (token) {
        authStore.saveTokens({ accessToken: token, refreshToken })
        try {
          await authStore.me()
          toastStore.success('Вы успешно авторизовались!')
          await router.push(AppRoutePaths.Trip.List)
        }
        catch (e) {
          console.error('[DeepLink] Ошибка валидации пользователя:', e)
          toastStore.error('Ошибка входа через внешнего провайдера')
          await router.push(AppRoutePaths.Auth.SignIn)
        }
      }
      return
    }

    // 2. Привязка аккаунта в настройках
    if (pathname.includes('/user/settings') || pathname.includes('/settings')) {
      const successKey = searchParams.get('oauth_success')
      const errorMsg = searchParams.get('oauth_error')

      if (successKey) {
        const providerMessages: Record<string, string> = {
          yandex_linked: 'Аккаунт Яндекс успешно привязан!',
          google_linked: 'Аккаунт Google успешно привязан!',
          github_linked: 'Аккаунт GitHub успешно привязан!',
        }
        toastStore.success(providerMessages[successKey] || 'Аккаунт успешно привязан!')
        await authStore.me()
      }
      else if (errorMsg) {
        toastStore.error(decodeURIComponent(errorMsg))
      }

      if (authStore.user?.id) {
        await router.push(`/user/${authStore.user.id}/settings`)
      }
      return
    }

    // 3. Открытие путешествия, постов, блога или других экранов
    if (
      pathname.startsWith('/trip/')
      || pathname.startsWith('/trips')
      || pathname.startsWith('/post/')
      || pathname.startsWith('/blog')
      || pathname.startsWith('/user/')
      || pathname === '/'
    ) {
      await router.isReady()
      await router.push({ path: pathname, query: Object.fromEntries(searchParams.entries()) })
    }
  }
  catch (err) {
    console.error('[DeepLink] Ошибка обработки deep link:', err)
  }
}

/**
 * Инициализирует слушатель Deep Link для нативных платформ Tauri.
 */
export function initializeDeepLinks(pinia: Pinia, router: Router): void {
  if (!isTauri)
    return

  const handleUrls = async (urls: string[]) => {
    for (const url of urls)
      await handleDeepLinkUrl(url, pinia, router)
  }

  onOpenUrl(handleUrls).catch((err) => {
    console.warn('[DeepLink] Не удалось инициализировать onOpenUrl:', err)
  })

  getCurrent()
    .then((urls) => {
      if (urls?.length)
        return handleUrls(urls)
    })
    .catch((err) => {
      console.warn('[DeepLink] Не удалось прочитать ссылку запуска:', err)
    })
}
