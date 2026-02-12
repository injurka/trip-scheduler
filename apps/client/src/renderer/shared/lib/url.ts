const serverUrl = import.meta.env.VITE_APP_SERVER_URL
const staticPath = import.meta.env.VITE_APP_SERVER_STATIC_PATH

/**
 * Преобразует относительный путь API в полный, абсолютный URL для статического ресурса.
 * @param path - Относительный путь к файлу (например, /avatars/user1.jpg).
 * @returns Полный URL (например, http://localhost:8080/static/images/avatars/user1.jpg).
 */
export function resolveApiUrl(path: string | null | undefined): string {
  if (!path) {
    return ''
  }

  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }

  const cleanedServer = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
  const cleanedStatic = staticPath.replace(/^\/|\/$/g, '')
  const cleanedPath = path.startsWith('/') ? path.slice(1) : path

  return `${cleanedServer}/${cleanedStatic}/${cleanedPath}`
}
