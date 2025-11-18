/// <reference lib="WebWorker" />
/// <reference types="vite/client" />
/// <reference types="@types/workbox-sw" />

type AssetType = 'hashed' | 'vendor' | 'regular'

interface ServiceWorkerMessage {
  type: 'SKIP_WAITING' | 'GET_CACHE_INFO' | 'CLEAR_CACHE'
  payload?: {
    cacheName?: string
  }
}

interface CacheInfo {
  name: string
  size: number
  urls: string[]
  totalSize?: number
}

const CACHE_CONFIG = {
  names: {
    webmanifest: 'trip-scheduler-pwa-webmanifest',
    fonts: 'trip-scheduler-fonts',
    images: 'trip-scheduler-images',
    icons: 'trip-scheduler-icons',
    airlineIcons: 'trip-scheduler-airline-favicons',
    hashedAssets: 'trip-scheduler-hashed-assets',
    vendorAssets: 'trip-scheduler-vendor-assets',
    regularAssets: 'trip-scheduler-regular-assets',
    maptiler: 'trip-scheduler-maptiler-tiles',
    geocoding: 'trip-scheduler-geocoding-api',
  },
  durations: {
    images: 365 * 24 * 60 * 60,
    fonts: 365 * 24 * 60 * 60,
    icons: 30 * 24 * 60 * 60,
    airlineIcons: 365 * 24 * 60 * 60,
    static: {
      hashed: 365 * 24 * 60 * 60,
      vendor: 30 * 24 * 60 * 60,
      regular: 2 * 60 * 60,
    },
    manifests: 7 * 24 * 60 * 60,
    maptiler: 30 * 24 * 60 * 60, // 30 дней
    geocoding: 30 * 24 * 60 * 60, // 30 дней
  },
  limits: {
    fonts: 30,
    images: 1000,
    icons: 500,
    airlineIcons: 200,
    hashedAssets: 200,
    vendorAssets: 100,
    regularAssets: 50,
    manifests: 100,
    maptiler: 1000,
    geocoding: 100,
  },
} as const

interface ApiCacheRule {
  path: string
  cacheName: string
  strategy: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate'
  maxAgeSeconds: number
  maxEntries: number
}

const API_CACHE_RULES: ApiCacheRule[] = [
  {
    path: 'trip.list',
    cacheName: 'trip-scheduler-api-trips',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 1 * 60 * 60 * 24, // 24 часа
    maxEntries: 10,
  },
  {
    path: 'day.getByTripId',
    cacheName: 'trip-scheduler-api-days',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 1 * 60 * 60 * 24, // 24 часа
    maxEntries: 50,
  },
  {
    path: 'trip.getByIdWithDays',
    cacheName: 'trip-scheduler-api-trip-details',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 1 * 60 * 60 * 24, // 24 часа
    maxEntries: 20,
  },
  {
    path: 'memory.getByTripId',
    cacheName: 'trip-scheduler-api-memories',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 1 * 60 * 60 * 24, // 24 часа
    maxEntries: 50,
  },
  {
    path: 'image.listByTrip',
    cacheName: 'trip-scheduler-api-route-images',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 1 * 60 * 60 * 24, // 24 часа
    maxEntries: 50,
  },
  {
    path: 'metro.listSystems',
    cacheName: 'trip-scheduler-api-metro-systems',
    strategy: 'CacheFirst',
    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
    maxEntries: 25,
  },
  {
    path: 'metro.getDetails',
    cacheName: 'trip-scheduler-api-metro-details',
    strategy: 'CacheFirst',
    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
    maxEntries: 50,
  },
]

interface MessageHandlers {
  SKIP_WAITING: () => Promise<void>
  GET_CACHE_INFO: (port: MessagePort) => Promise<void>
  CLEAR_CACHE: (port: MessagePort, payload?: { cacheName?: string }) => Promise<void>
}

interface MessageHandlers {
  SKIP_WAITING: () => Promise<void>
  GET_CACHE_INFO: (port: MessagePort) => Promise<void>
  CLEAR_CACHE: (port: MessagePort, payload?: { cacheName?: string }) => Promise<void>
}

export {
  API_CACHE_RULES,
  type AssetType,
  CACHE_CONFIG,
  type CacheInfo,
  type MessageHandlers,
  type ServiceWorkerMessage,
}
