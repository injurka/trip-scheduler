/** Приложение запущено внутри Tauri (десктоп или мобильное приложение) */
export const isTauri = '__TAURI_INTERNALS__' in window

/** Мобильное устройство по User-Agent */
export const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|windows phone|windows mobile|kindle|silk|fennec|mobile|tablet/i.test(navigator.userAgent)

/** Мобильная сборка приложения (APK/iOS через Tauri) */
export const isMobileApp = isTauri && isMobile

/** Базовый URL сервера: env при сборке → прод для Tauri → пусто для веба */
export const SERVER_URL = import.meta.env.VITE_APP_SERVER_URL || (isTauri ? 'https://trip-scheduler-api.limited-dissolve.ru' : '')

/** Базовый публичный URL веб-версии приложения */
export const WEB_APP_URL = import.meta.env.VITE_APP_CLIENT_URL || 'https://trip-scheduler.limited-dissolve.ru'

/** Получает базовый URL приложения для формирования публичных ссылок */
export function getAppBaseUrl(): string {
  if (isTauri) {
    return WEB_APP_URL
  }

  return typeof window !== 'undefined' ? window.location.origin : WEB_APP_URL
}
