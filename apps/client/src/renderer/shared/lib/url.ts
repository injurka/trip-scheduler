import { SERVER_URL } from './env'

const serverUrl = SERVER_URL
const IMAGE_ROUTE = 'image'

function isOurServerUrl(base: string, isRelativeApiPath: boolean): boolean {
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')

  return isRelativeApiPath
    || (normalizedServerUrl.length > 0 && (base === normalizedServerUrl || base.startsWith(`${normalizedServerUrl}/`)))
}

function appendAuthToken(base: string, token: string): string {
  try {
    const url = new URL(base)
    url.searchParams.set('token', token)

    return url.toString()
  }
  catch {
    const separator = base.includes('?') ? '&' : '?'

    return `${base}${separator}token=${encodeURIComponent(token)}`
  }
}

function createImageSearchParams(options: ImageOptions): URLSearchParams {
  const params = new URLSearchParams()

  if (options.w)
    params.set('w', String(options.w))

  if (options.h)
    params.set('h', String(options.h))

  if (options.fmt)
    params.set('fmt', options.fmt)

  if (options.q)
    params.set('q', String(options.q))

  return params
}

function appendImageOptions(base: string, options: ImageOptions): string {
  const params = createImageSearchParams(options)
  const query = params.toString()

  if (!query)
    return base

  const separator = base.includes('?') ? '&' : '?'

  return `${base}${separator}${query}`
}

/**
 * Преобразует относительный путь API в полный, абсолютный URL для статического ресурса.
 * @param path - Относительный путь к файлу (например, /avatars/user1.jpg).
 * @returns Полный URL (например, http://localhost:8080/avatars/user1.jpg).
 */
export function resolveApiUrl(path: string | null | undefined): string {
  if (!path) {
    return ''
  }

  const isHttpUrl = path.startsWith('http://') || path.startsWith('https://')
  const isBlobUrl = path.startsWith('blob:')
  const isRelativeApiPath = !isHttpUrl && !isBlobUrl

  let base = path

  if (isRelativeApiPath) {
    const cleanedServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path
    base = `${cleanedServer}/${IMAGE_ROUTE}/${cleanedPath}`
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token')

    if (token) {
      if (isOurServerUrl(base, isRelativeApiPath))
        return appendAuthToken(base, token)
    }
  }

  return base
}

export interface ImageOptions {
  w?: number
  h?: number
  fmt?: 'webp' | 'avif' | 'jpeg' | 'png'
  q?: number
}

export function getImageUrl(path: string | null | undefined, options?: ImageOptions): string | undefined {
  if (!path)
    return undefined

  const base = resolveApiUrl(path)

  if (!base)
    return undefined

  if (!options)
    return base

  const params = createImageSearchParams(options)

  try {
    const url = new URL(base)
    params.forEach((value, key) => url.searchParams.set(key, value))

    return url.toString()
  }
  catch {
    return appendImageOptions(base, options)
  }
}

/**
 * Возвращает публичную ссылку на ICS-календарь путешествия.
 * Ссылка ведёт на API-сервер (а не на origin веб-клиента, который отдаёт только SPA).
 * @param slugOrId - shareSlug (приоритетно) либо ID путешествия.
 */
export function getTripCalendarUrl(slugOrId: string): string {
  let base = serverUrl

  if (!base && typeof window !== 'undefined') {
    if (window.location.hostname === 'trip-scheduler.limited-dissolve.ru') {
      base = 'https://trip-scheduler-api.limited-dissolve.ru'
    }
    else {
      base = window.location.origin
    }
  }

  const normalizedBase = (base || 'https://trip-scheduler-api.limited-dissolve.ru').replace(/\/+$/, '')

  return `${normalizedBase}/api/trips/${encodeURIComponent(slugOrId)}/calendar.ics`
}

/**
 * Преобразует http(s)-ссылку на календарь в webcal:// для подписки в нативных календарях.
 */
export function toWebcalUrl(httpUrl: string): string {
  return httpUrl.replace(/^https?:\/\//, 'webcal://')
}

/**
 * Удаляет только параметр авторизации `token` из URL, сохраняя остальные query-параметры (w, h, fmt и т.д.)
 */
export function stripAuthTokenFromUrl(url: string | null | undefined): string {
  if (!url)
    return ''

  try {
    const isAbsolute = url.startsWith('http://') || url.startsWith('https://')
    const parsed = new URL(url, isAbsolute ? undefined : 'http://localhost')

    if (parsed.searchParams.has('token')) {
      parsed.searchParams.delete('token')
    }

    if (!isAbsolute) {
      const search = parsed.search ? parsed.search : ''

      return `${parsed.pathname}${search}`
    }

    return parsed.toString()
  }
  catch {
    return url.replace(/([?&])token=[^&]*(&|$)/, (_, sep, rest) => (rest ? sep : ''))
  }
}
