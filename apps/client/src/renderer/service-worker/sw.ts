/* eslint-disable no-console */
import type { ServiceWorkerMessage } from './model/types'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { OFFLINE_MEDIA_CACHE_NAME } from './constant'
import { messageHandlers } from './lib/message-handlers'
import { AssetAnalyzer, CacheStrategyFactory } from './lib/utils'
import { API_CACHE_RULES, CACHE_CONFIG } from './model/types'

declare let self: ServiceWorkerGlobalScope

clientsClaim()

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST || [])

const runtimeImageStrategy = CacheStrategyFactory.createStaleWhileRevalidate(
  CACHE_CONFIG.names.images,
  {
    maxEntries: CACHE_CONFIG.limits.images,
    maxAgeSeconds: CACHE_CONFIG.durations.images,
  },
)

registerRoute(
  ({ request }) => request.destination === 'image',
  async ({ request, url, event }) => {
    if (url.pathname.includes('/memories/')) {
      // eslint-disable-next-line no-useless-catch
      try {
        return await fetch(request)
      }
      catch (e) {
        throw e
      }
    }

    try {
      const offlineCache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)
      const offlineResponse = await offlineCache.match(request)
      if (offlineResponse) {
        if (import.meta.env.DEV)
          console.log(`[SW] Served from Offline Cache: ${url.pathname}`)
        return offlineResponse
      }
    }
    catch {
    }

    return runtimeImageStrategy.handle({ event, request, url } as any)
  },
)

if (import.meta.env.PROD) {
  // WEB APP MANIFEST
  registerRoute(
    ({ request, sameOrigin }) => sameOrigin && request.destination === 'manifest',
    CacheStrategyFactory.createNetworkFirst(
      CACHE_CONFIG.names.webmanifest,
      {
        maxEntries: CACHE_CONFIG.limits.manifests,
        maxAgeSeconds: CACHE_CONFIG.durations.manifests,
      },
    ),
  )

  // FONTS
  registerRoute(
    ({ request }) => request.destination === 'font',
    CacheStrategyFactory.createCacheFirst(
      CACHE_CONFIG.names.fonts,
      {
        maxEntries: CACHE_CONFIG.limits.fonts,
        maxAgeSeconds: CACHE_CONFIG.durations.fonts,
        statuses: [0, 200],
      },
    ),
  )

  // AIRLINE ICONS
  registerRoute(
    ({ url }) =>
      url.hostname === 'www.skyscanner.net'
      && url.pathname.startsWith('/images/airlines/favicon/'),
    CacheStrategyFactory.createCacheFirst(
      CACHE_CONFIG.names.airlineIcons,
      {
        maxEntries: CACHE_CONFIG.limits.airlineIcons,
        maxAgeSeconds: CACHE_CONFIG.durations.airlineIcons,
      },
    ),
  )

  // MAPTILER TILES
  registerRoute(
    ({ url }) => url.hostname === 'api.maptiler.com',
    CacheStrategyFactory.createCacheFirst(
      CACHE_CONFIG.names.maptiler,
      {
        maxEntries: CACHE_CONFIG.limits.maptiler,
        maxAgeSeconds: CACHE_CONFIG.durations.maptiler,
      },
    ),
  )
}

// GEOCODING API
registerRoute(
  ({ url }) => url.hostname === 'geocoding-api.open-meteo.com',
  CacheStrategyFactory.createStaleWhileRevalidate(
    CACHE_CONFIG.names.geocoding,
    {
      maxEntries: CACHE_CONFIG.limits.geocoding,
      maxAgeSeconds: CACHE_CONFIG.durations.geocoding,
    },
  ),
)

registerRoute(
  ({ url }) => url.hostname === 'api.iconify.design',
  CacheStrategyFactory.createStaleWhileRevalidate(
    CACHE_CONFIG.names.icons,
    {
      maxEntries: CACHE_CONFIG.limits.icons,
      maxAgeSeconds: CACHE_CONFIG.durations.icons,
    },
  ),
)

// --- СТАТИЧЕСКИЕ АССЕТЫ (JS, CSS) ---

const hashedAssetsStrategy = CacheStrategyFactory.createCacheFirst(
  CACHE_CONFIG.names.hashedAssets,
  {
    maxEntries: CACHE_CONFIG.limits.hashedAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.hashed,
  },
)

const vendorAssetsStrategy = CacheStrategyFactory.createCacheFirst(
  CACHE_CONFIG.names.vendorAssets,
  {
    maxEntries: CACHE_CONFIG.limits.vendorAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.vendor,
    statuses: [0, 200],
  },
)

const regularAssetsStrategy = CacheStrategyFactory.createStaleWhileRevalidate(
  CACHE_CONFIG.names.regularAssets,
  {
    maxEntries: CACHE_CONFIG.limits.regularAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.regular,
  },
)

function isScriptOrStyle({ request, sameOrigin }: { request: Request, sameOrigin: boolean }) {
  return sameOrigin && (request.destination === 'script' || request.destination === 'style')
}

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'hashed',
  hashedAssetsStrategy,
)

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'vendor',
  vendorAssetsStrategy,
)

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'regular',
  regularAssetsStrategy,
)

// --- API КЕШИРОВАНИЕ ---
API_CACHE_RULES.forEach((rule) => {
  let strategy

  const options = {
    maxEntries: rule.maxEntries,
    maxAgeSeconds: rule.maxAgeSeconds,
  }

  switch (rule.strategy) {
    case 'CacheFirst':
      strategy = CacheStrategyFactory.createCacheFirst(rule.cacheName, { ...options, statuses: [200] })
      break
    case 'NetworkFirst':
      strategy = CacheStrategyFactory.createNetworkFirst(rule.cacheName, options)
      break
    case 'StaleWhileRevalidate':
      strategy = CacheStrategyFactory.createStaleWhileRevalidate(rule.cacheName, options)
      break
    default:
      throw new Error(`Unknown cache strategy: ${rule.strategy}`)
  }

  registerRoute(
    ({ request, url }) =>
      request.method === 'GET'
      && url.pathname.includes(rule.path),
    strategy,
  )
})

// --- SPA НАВИГАЦИЯ ---

let allowlist: undefined | RegExp[]
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    /^\/api\//,
    /^\/sw.js$/,
    /^\/manifest-(.*).webmanifest$/,
    /^\/workbox-.*\.js$/,
  ]
}

registerRoute(new NavigationRoute(
  createHandlerBoundToURL('/'),
  {
    allowlist,
    denylist,
  },
))

// --- WEB PUSH NOTIFICATIONS ---

self.addEventListener('push', (event) => {
  if (!event.data)
    return

  try {
    const data = event.data.json()
    const title = data.title || 'Trip Scheduler'
    const options: NotificationOptions = {
      body: data.body,
      icon: '/pwa-192x192.png', // Убедитесь, что иконка существует
      badge: '/badge-72x72.png', // Монохромная иконка для статус-бара Android
      data: data.data || {}, // Здесь может лежать url для перехода
      tag: data.tag, // Для группировки уведомлений
    }

    event.waitUntil(self.registration.showNotification(title, options))
  }
  catch (err) {
    console.error('[SW] Error parsing push data', err)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Если вкладка уже открыта - фокусируемся на ней
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Иначе открываем новую
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    }),
  )
})

// --- ОБРАБОТКА СООБЩЕНИЙ ---

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data as ServiceWorkerMessage
  const port = event.ports[0]

  if (!port)
    return

  const handler = messageHandlers[type]
  if (handler) {
    try {
      await handler(port, payload)
    }
    catch (error) {
      console.error(`Ошибка при обработке сообщения "${type}":`, error)
      port.postMessage({
        type: 'ERROR',
        payload: { message: `Внутренняя ошибка при обработке: ${type}` },
      })
    }
  }
  else {
    port.postMessage({
      type: 'ERROR',
      payload: { message: `Неизвестный тип сообщения: ${type}` },
    })
  }
})

if (import.meta.env.DEV) {
  console.log('🔧 Service Worker в режиме разработки')

  self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
      const assetType = AssetAnalyzer.getAssetType(event.request.url)
      if (!event.request.url.includes('/api/')) {
        console.log(`📥 ${assetType}: ${event.request.url}`)
      }
    }
  })
}
