import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import * as maplibregl from 'maplibre-gl'
// ?worker&url — Vite соберёт воркер вместе с maplibre-gl-shared.mjs в один
// самодостаточный чанк. Обычный ?url копирует dist/maplibre-gl-worker.mjs как есть,
// а у него наверху `import ... from "./maplibre-gl-shared.mjs"` — этого файла в dist нет,
// воркер падает с 404 (карта не рендерится).
import maplibreModuleWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

let workerUrlReady: Promise<void> = Promise.resolve()

if (typeof window !== 'undefined') {
  const isTauriOrMobile = '__TAURI_INTERNALS__' in window || window.location.protocol === 'tauri:'
  const staticWorkerUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/maplibre-gl-worker.js`

  if (isTauriOrMobile) {
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
 * Подключение 3D-рельефа местности
 */
export function applyTerrain(map: MapLibreMap, key = MAPTILER_KEY, exaggeration = 1.5): void {
  if (!key)
    return

  try {
    // Если стиль не растровый OSM, и в нём есть или поддерживается DEM
    const hasExistingTerrain = Boolean(
      map.getSource('maptiler-terrain')
      || map.getSource('terrain-rgb')
      || map.getSource('terrain'),
    )

    const terrainSourceId = map.getSource('terrain-rgb') ? 'terrain-rgb' : MAPTILER_TERRAIN_SOURCE_ID

    if (!hasExistingTerrain && !map.getSource(terrainSourceId)) {
      map.addSource(terrainSourceId, {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`,
        tileSize: 512,
        maxzoom: 14,
      })
    }

    if (map.getSource(terrainSourceId)) {
      map.setTerrain({
        source: terrainSourceId,
        exaggeration,
      })
    }
  }
  catch (err) {
    console.warn('[map-styles-sources] Не удалось активировать 3D-рельеф:', err)
  }
}

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
