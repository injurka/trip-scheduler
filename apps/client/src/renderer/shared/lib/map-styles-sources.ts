import type TileSource from 'ol/source/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'

export type TileSourceId = 'maptilerOutdoor' | 'maptilerStreets' | 'satellite' | 'osm'

export interface MapSourceMeta {
  label: string
  icon: string
  description?: string
}

export interface MapSourceConfig extends MapSourceMeta {
  source: TileSource
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string

const MAPTILER_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'

export const TILE_SOURCES_META: Record<TileSourceId, MapSourceMeta> = {
  maptilerOutdoor: {
    label: 'Outdoor & Приключения',
    icon: 'mdi:hiking',
    description: 'Туристические и горные тропы, отмывка рельефа, изолинии высот и родники',
  },
  maptilerStreets: {
    label: 'Улицы и Город',
    icon: 'mdi:map-outline',
    description: 'Четкая городская навигация, здания и дорожная сеть',
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
 * Фабрика источников тайлов. Создает изолированный инстанс источника
 * с поддержкой Retina (@2x) и tilePixelRatio для исключения конфликтов кэша.
 */
export function createTileSource(id: TileSourceId): TileSource {
  const isRetina = typeof window !== 'undefined' && window.devicePixelRatio > 1
  const retinaSuffix = isRetina ? '@2x' : ''
  const tilePixelRatio = isRetina ? 2 : 1

  switch (id) {
    case 'maptilerOutdoor':
      return new XYZ({
        url: `https://api.maptiler.com/maps/outdoor-v4/{z}/{x}/{y}${retinaSuffix}.png?key=${MAPTILER_KEY}`,
        tileSize: 512,
        tilePixelRatio,
        crossOrigin: 'anonymous',
        maxZoom: 20,
        attributions: MAPTILER_ATTRIBUTION,
      })
    case 'maptilerStreets':
      return new XYZ({
        url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}${retinaSuffix}.png?key=${MAPTILER_KEY}`,
        tileSize: 512,
        tilePixelRatio,
        crossOrigin: 'anonymous',
        maxZoom: 20,
        attributions: MAPTILER_ATTRIBUTION,
      })
    case 'satellite':
      return new XYZ({
        url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}${retinaSuffix}.jpg?key=${MAPTILER_KEY}`,
        tileSize: 512,
        tilePixelRatio,
        crossOrigin: 'anonymous',
        maxZoom: 20,
        attributions: MAPTILER_ATTRIBUTION,
      })
    case 'osm':
    default:
      return new OSM({
        crossOrigin: 'anonymous',
      })
  }
}

export const TILE_SOURCES: Record<TileSourceId, MapSourceConfig> = {
  get maptilerOutdoor() {
    return { ...TILE_SOURCES_META.maptilerOutdoor, source: createTileSource('maptilerOutdoor') }
  },
  get maptilerStreets() {
    return { ...TILE_SOURCES_META.maptilerStreets, source: createTileSource('maptilerStreets') }
  },
  get satellite() {
    return { ...TILE_SOURCES_META.satellite, source: createTileSource('satellite') }
  },
  get osm() {
    return { ...TILE_SOURCES_META.osm, source: createTileSource('osm') }
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
