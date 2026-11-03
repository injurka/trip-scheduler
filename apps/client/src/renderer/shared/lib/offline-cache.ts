import { resolveApiUrl, stripAuthTokenFromUrl } from './url'

export const OFFLINE_CACHE_READY_URL = 'https://offline.trip-scheduler.local/ready'
export const OFFLINE_CACHE_PREFIX = 'trip-scheduler-offline-v2-'

export function getOfflineAccountId(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null')

    return typeof user?.id === 'string' ? user.id : null
  }
  catch {
    return null
  }
}

export function getOfflineCachePrefix(accountId: string): string {
  return `${OFFLINE_CACHE_PREFIX}${encodeURIComponent(accountId)}:`
}

/** Search only the current account's committed/download caches. Never read legacy shared caches. */
export async function findOfflineMediaResponse(rawUrl: string): Promise<Response | null> {
  const accountId = getOfflineAccountId()

  if (!accountId || typeof caches === 'undefined' || !rawUrl)
    return null

  const url = resolveApiUrl(rawUrl)
  const cleanUrl = stripAuthTokenFromUrl(url)

  try {
    const names = await caches.keys()

    for (const name of names.filter(name => name.startsWith(getOfflineCachePrefix(accountId))).reverse()) {
      const cache = await caches.open(name)

      if (!await cache.match(OFFLINE_CACHE_READY_URL))
        continue

      const response = await cache.match(url) || await cache.match(cleanUrl)

      if (response && getOfflineAccountId() === accountId)
        return response
    }

    return null
  }
  catch {
    return null
  }
}

export async function getOfflineImageUrl(url: string): Promise<string | null> {
  try {
    const response = await findOfflineMediaResponse(url)

    // Opaque responses can be served by a SW but cannot be decoded into a Blob in a WebView.
    if (!response || response.type === 'opaque')
      return null

    return URL.createObjectURL(await response.blob())
  }
  catch {
    return null
  }
}
