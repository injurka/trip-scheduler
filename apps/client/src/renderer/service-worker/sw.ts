/* eslint-disable no-console */
import type { ServiceWorkerMessage } from './model/types'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { messageHandlers } from './lib/message-handlers'
import { AssetAnalyzer, CacheStrategyFactory } from './lib/utils'
import { API_CACHE_RULES, CACHE_CONFIG } from './model/types'

declare let self: ServiceWorkerGlobalScope

clientsClaim()

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST || [])

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

  // IMAGE
  registerRoute(
    ({ request, url }) => {
      if (request.destination !== 'image')
        return false

      const isMemoryImage = url.pathname.includes('/memories/')
      // Если это не изображение из "воспоминаний", кешируем его по умолчанию
      if (!isMemoryImage)
        return true

      // Если это изображение из "воспоминаний", мы кешируем его только если
      // в названии есть суффикс размера. Это предотвращает кеширование
      // оригинальных, больших изображений.
      const hasSizeSuffix = /-medium|-large|-small/.test(url.pathname)

      return hasSizeSuffix
    },
    CacheStrategyFactory.createStaleWhileRevalidate(
      CACHE_CONFIG.names.images,
      {
        maxEntries: CACHE_CONFIG.limits.images,
        maxAgeSeconds: CACHE_CONFIG.durations.images,
      },
    ),
  )

  // AIRLINE ICONS (skyscanner)
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

// GEOCODING API (Open-Meteo)
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

// JS/CSS
function isScriptOrStyle({ request, sameOrigin }: { request: Request, sameOrigin: boolean }) {
  return sameOrigin && (request.destination === 'script' || request.destination === 'style')
}

// Маршрут для хешированных ассетов
registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'hashed',
  hashedAssetsStrategy,
)

// Маршрут для вендорных ассетов
registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'vendor',
  vendorAssetsStrategy,
)

// Маршрут для обычных ассетов
registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'regular',
  regularAssetsStrategy,
)

// API
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

      console.log(`📥 ${assetType}: ${event.request.url}`)
    }
  })
}
