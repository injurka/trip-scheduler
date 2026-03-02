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

  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }

  const cleanedServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
  const cleanedPath = path.startsWith('/') ? path.slice(1) : path

  return `${cleanedServer}/${IMAGE_ROUTE}/${cleanedPath}`
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
  if (!base || !options)
    return base || undefined

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

  return query ? `${base}?${query}` : base
}
