/** Приложение запущено внутри Tauri (десктоп или мобильное приложение) */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Мобильное устройство по User-Agent */
export const isMobile = typeof navigator !== 'undefined'
  && /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|windows phone|windows mobile|kindle|silk|fennec|mobile|tablet/i.test(navigator.userAgent)

/** Мобильная сборка приложения (APK/iOS через Tauri) */
export const isMobileApp = isTauri && isMobile

function resolveServerUrl(): string {
  const envUrl = import.meta.env.VITE_APP_SERVER_URL

  if (envUrl && envUrl !== '__VITE_APP_SERVER_URL__') {
    return envUrl
  }

  if (isTauri) {
    return 'https://trip-scheduler-api.limited-dissolve.ru'
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'trip-scheduler.limited-dissolve.ru') {
    return 'https://trip-scheduler-api.limited-dissolve.ru'
  }

  return ''
}

/** Базовый URL сервера: env при сборке → прод для Tauri/прод веб-домена → пусто для локального дева */
export const SERVER_URL = resolveServerUrl()

/** Базовый публичный URL веб-версии приложения */
export const WEB_APP_URL = import.meta.env.VITE_APP_CLIENT_URL || 'https://trip-scheduler.limited-dissolve.ru'

/** Получает базовый URL приложения для формирования публичных ссылок */
export function getAppBaseUrl(): string {
  if (isTauri) {
    return WEB_APP_URL
  }

  return typeof window !== 'undefined' ? window.location.origin : WEB_APP_URL
}
