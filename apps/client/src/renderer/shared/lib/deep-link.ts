import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { AppRoutePaths } from '~/shared/constants/routes'
import { verifyOAuthClientState } from '~/shared/lib/oauth-state'
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

function normalizeDeepLinkUrl(rawUrl: string): string {
  if (!rawUrl.startsWith(`${DEEP_LINK_SCHEME}://`))
    return rawUrl

  const pathPart = rawUrl.replace(new RegExp(`^${DEEP_LINK_SCHEME}://`), '').replace(/^\/+/, '')

  return `http://localhost/${pathPart}`
}

async function handleAuthCallback(
  searchParams: URLSearchParams,
  authStore: ReturnType<typeof useAuthStore>,
  toastStore: ReturnType<typeof useToastStore>,
  router: Router,
): Promise<void> {
  const token = searchParams.get('token')

  if (!token)
    return

  const refreshToken = searchParams.get('refreshToken') || undefined
  authStore.saveTokens({ accessToken: token, refreshToken })

  try {
    await authStore.me()
    toastStore.success('Вы успешно авторизовались!')
    await router.push(AppRoutePaths.Trip.List)
  }
  catch (error) {
    console.error('[DeepLink] Ошибка валидации пользователя:', error)
    toastStore.error('Ошибка входа через внешнего провайдера')
    await router.push(AppRoutePaths.Auth.SignIn)
  }
}

async function handleUserSettingsLink(
  searchParams: URLSearchParams,
  authStore: ReturnType<typeof useAuthStore>,
  toastStore: ReturnType<typeof useToastStore>,
  router: Router,
): Promise<void> {
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

  if (authStore.user?.id)
    await router.push(`/user/${authStore.user.id}/settings`)
}

function isValidOAuthLinkCallback(searchParams: URLSearchParams, toastStore: ReturnType<typeof useToastStore>): boolean {
  if (!searchParams.has('oauth_success') && !searchParams.has('oauth_error'))
    return true

  const isValid = verifyOAuthClientState(searchParams.get('oauth_state'))

  if (!isValid)
    toastStore.error('Не удалось подтвердить привязку аккаунта. Повторите попытку.')

  return isValid
}

function isSupportedDeepLinkPath(pathname: string): boolean {
  return pathname.startsWith('/trip/')
    || pathname.startsWith('/trips')
    || pathname.startsWith('/post/')
    || pathname.startsWith('/blog')
    || pathname.startsWith('/user/')
    || pathname === '/'
}

/**
 * Обрабатывает входящий deep link URI (например, trip-scheduler://trip/... или https://trip-scheduler.limited-dissolve.ru/trip/...)
 */
export async function handleDeepLinkUrl(rawUrl: string, pinia: Pinia, router: Router): Promise<void> {
  if (!rawUrl)
    return

  try {
    const parsed = new URL(normalizeDeepLinkUrl(rawUrl))
    const pathname = parsed.pathname
    const searchParams = parsed.searchParams

    const authStore = useAuthStore(pinia)
    const toastStore = useToastStore(pinia)

    // 1. Авторизация через OAuth callback
    if (pathname.includes('/auth/callback') || pathname.startsWith('/auth/callback')) {
      if (!verifyOAuthClientState(searchParams.get('oauth_state'))) {
        toastStore.error('Не удалось подтвердить вход. Повторите попытку.')
        await router.push(AppRoutePaths.Auth.SignIn)

        return
      }

      await handleAuthCallback(
        searchParams,
        authStore,
        toastStore,
        router,
      )

      return
    }

    // 2. Привязка аккаунта в настройках
    if (pathname.includes('/user/settings') || pathname.includes('/settings')) {
      if (!isValidOAuthLinkCallback(searchParams, toastStore))
        return

      await handleUserSettingsLink(
        searchParams,
        authStore,
        toastStore,
        router,
      )

      return
    }

    // 3. Открытие путешествия, постов, блога или других экранов
    if (isSupportedDeepLinkPath(pathname)) {
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
export function initializeDeepLinks(pinia: Pinia, router: Router, sessionReady: Promise<void> = Promise.resolve()): void {
  if (!isTauri)
    return

  const handledOAuthCallbacks = new Set<string>()
  let processing = sessionReady

  const handleUrls = async (urls: string[]) => {
    for (const url of urls) {
      processing = processing.then(async () => {
        const parsed = new URL(normalizeDeepLinkUrl(url))
        const isOAuthCallback = parsed.pathname === '/auth/callback'
          || parsed.searchParams.has('oauth_success')
          || parsed.searchParams.has('oauth_error')

        if (isOAuthCallback && handledOAuthCallbacks.has(url))
          return

        if (isOAuthCallback) {
          handledOAuthCallbacks.add(url)

          if (handledOAuthCallbacks.size > 16)
            handledOAuthCallbacks.delete(handledOAuthCallbacks.values().next().value!)
        }

        await handleDeepLinkUrl(url, pinia, router)
      }).catch(() => {
        console.warn('[DeepLink] Не удалось обработать входящую ссылку')
      })
    }

    await processing
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
