const serverUrl = import.meta.env.VITE_APP_SERVER_URL
const IMAGE_ROUTE = 'image'

/**
 * Преобразует относительный путь API в полный, абсолютный URL для статического ресурса.
 * @param path - Относительный путь к файлу (например, /avatars/user1.jpg).
 * @returns Полный URL (например, http://localhost:8080/avatars/user1.jpg).
 */
export function resolveApiUrl(path: string | null | undefined): string {
  if (!path) {
    return ''
  }

  let base = path
  if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('blob:')) {
    const cleanedServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path
    base = `${cleanedServer}/${IMAGE_ROUTE}/${cleanedPath}`
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token')
    if (token) {
      const isOurServer = (!path.startsWith('http://') && !path.startsWith('https://'))
        || base.startsWith(serverUrl)

      if (isOurServer) {
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

export function getImageUrl(
  path: string | null | undefined,
  options?: ImageOptions,
): string | undefined {
  if (!path)
    return undefined

  const base = resolveApiUrl(path)
  if (!base)
    return undefined

  if (!options)
    return base

  try {
    const url = new URL(base)
    if (options.w)
      url.searchParams.set('w', String(options.w))
    if (options.h)
      url.searchParams.set('h', String(options.h))
    if (options.fmt)
      url.searchParams.set('fmt', options.fmt)
    if (options.q)
      url.searchParams.set('q', String(options.q))
    return url.toString()
  }
  catch {
    const params = new URLSearchParams()
    if (options.w)
      params.set('w', String(options.w))
    if (options.h)
      params.set('h', String(options.h))
    if (options.fmt)
      params.set('fmt', options.fmt)
    if (options.q)
      params.set('q', String(options.q))

    const query = params.toString()
    if (!query)
      return base

    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}${query}`
  }
}
