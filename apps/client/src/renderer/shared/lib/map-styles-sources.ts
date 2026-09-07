import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import * as maplibregl from 'maplibre-gl'
import maplibreModuleWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

let workerUrlReady: Promise<void> = Promise.resolve()

if (typeof window !== 'undefined') {
  // В мобильных webview (Android APK/Tauri) и старых webview загрузка worker ES-модулей с относительным
  // путем или сторонними схемами (tauri://, http://tauri.localhost) часто блокируется Same-Origin политикой
  // либо терпит крах при импорте не-бандленного ./maplibre-gl-shared.mjs.
  // Мы используем предсобранный автономный IIFE воркер из public/maplibre-gl-worker.js с автоматическим fallback.
  const isTauriOrMobile = '__TAURI_INTERNALS__' in window || window.location.protocol === 'tauri:'
  const staticWorkerUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/maplibre-gl-worker.js`

  if (isTauriOrMobile) {
    // В Tauri Android ассеты раздаются через перехват запросов на http://tauri.localhost — это
    // не secure context, и new Worker(url) оттуда не стартует (воркер не запускается, тайлы не
    // грузятся, карта остаётся с фоном). При этом сам файл воркера в основном треде доступен как
    // обычный ресурс — скачиваем его и создаём blob-URL, воркеры из blob в Android WebView работают.
    workerUrlReady = (async () => {
      try {
        const res = await fetch(staticWorkerUrl)
        if (!res.ok)
          throw new Error(`HTTP ${res.status}`)
        const blob = new Blob([await res.text()], { type: 'text/javascript' })
        maplibregl.setWorkerUrl(URL.createObjectURL(blob))
      }
      catch (e) {
        console.warn('[map-styles-sources] Не удалось создать blob-воркер, откат на статический URL:', e)
        try {
          maplibregl.setWorkerUrl(staticWorkerUrl)
        }
        catch (fallbackError) {
          console.warn('[map-styles-sources] Не удалось установить workerUrl:', fallbackError)
        }
      }
    })()
  }
  else {
    try {
      maplibregl.setWorkerUrl(maplibreModuleWorkerUrl || staticWorkerUrl)
    }
    catch (e) {
      console.warn('[map-styles-sources] Не удалось установить workerUrl:', e)
    }
  }
}

/**
 * Гарантия, что workerUrl установлен до создания первой карты.
 * В Tauri Android установка асинхронная (fetch → blob), поэтому ожидаем явно.
 */
export function ensureMaplibreWorkerReady(): Promise<void> {
  return workerUrlReady
}

export type TileSourceId = 'maptilerOutdoor' | 'maptilerStreets' | 'satellite' | 'osm'

export interface MapSourceMeta {
  label: string
  icon: string
  description?: string
}

export interface MapSourceConfig extends MapSourceMeta {
  style: string | StyleSpecification
}

export const MAPTILER_KEY = String(import.meta.env.VITE_MAPTILER_KEY || '').trim()

export const MAPTILER_TERRAIN_SOURCE_ID = 'maptiler-terrain'

export const TILE_SOURCES_META: Record<TileSourceId, MapSourceMeta> = {
  maptilerStreets: {
    label: 'Улицы и Город',
    icon: 'mdi:map-outline',
    description: 'Четкая городская навигация, здания и дорожная сеть',
  },
  maptilerOutdoor: {
    label: 'Природа и Приключения',
    icon: 'mdi:hiking',
    description: 'Туристические и горные тропы, 3D-рельеф, изолинии высот и родники',
  },
  satellite: {
    label: 'Спутник',
    icon: 'mdi:satellite-variant',
    description: 'Детальные спутниковые снимки местности',
  },
  osm: {
    label: 'OpenStreetMap',
    icon: 'mdi:map',
    description: 'Базовая карта сообщества OpenStreetMap',
  },
}

/**
 * Базовый растровый стиль OpenStreetMap для оффлайн/фолбэк режима без API-ключа
 */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

/**
 * Получить векторный JSON-стиль MapTiler или фолбэк OSM
 */
export function getMapStyle(id: TileSourceId): string | StyleSpecification {
  if (id === 'osm' || !MAPTILER_KEY) {
    return OSM_STYLE
  }

  switch (id) {
    case 'maptilerOutdoor':
      return `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${MAPTILER_KEY}`
    case 'maptilerStreets':
      return `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`
    case 'satellite':
      return `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`

    default:
      return `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`
  }
}

/**
 * Подключение источника высот Terrain-RGB и активация 3D-рельефа местности
 */
export function applyTerrain(map: MapLibreMap, key = MAPTILER_KEY, exaggeration = 1.5): void {
  if (!key)
    return

  try {
    const terrainSourceId = map.getSource('terrain-rgb') ? 'terrain-rgb' : MAPTILER_TERRAIN_SOURCE_ID
    if (!map.getSource(terrainSourceId)) {
      map.addSource(MAPTILER_TERRAIN_SOURCE_ID, {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 512,
        maxzoom: 14,
      })
    }

    map.setTerrain({
      source: terrainSourceId,
      exaggeration,
    })
  }
  catch (err) {
    console.warn('[map-styles-sources] Не удалось активировать 3D-рельеф:', err)
  }
}

/**
 * Совместимость с legacy-вызовами createTileSource
 */
export function createTileSource(id: TileSourceId): string | StyleSpecification {
  return getMapStyle(id)
}

export const TILE_SOURCES: Record<TileSourceId, MapSourceConfig> = {
  get maptilerOutdoor() {
    return { ...TILE_SOURCES_META.maptilerOutdoor, style: getMapStyle('maptilerOutdoor') }
  },
  get maptilerStreets() {
    return { ...TILE_SOURCES_META.maptilerStreets, style: getMapStyle('maptilerStreets') }
  },
  get satellite() {
    return { ...TILE_SOURCES_META.satellite, style: getMapStyle('satellite') }
  },
  get osm() {
    return { ...TILE_SOURCES_META.osm, style: getMapStyle('osm') }
  },
}

let isAvailabilityChecked: boolean | null = null

export async function checkMapTilerAvailability(): Promise<boolean> {
  if (!MAPTILER_KEY)
    return false

  if (isAvailabilityChecked !== null)
    return isAvailabilityChecked

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(`https://api.maptiler.com/maps/outdoor-v4/tiles.json?key=${MAPTILER_KEY}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    isAvailabilityChecked = res.ok
    return res.ok
  }
  catch {
    isAvailabilityChecked = false
    return false
  }
}
