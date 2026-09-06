import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'

export type TileSourceId = 'maptilerOutdoor' | 'maptilerStreets' | 'satellite' | 'osm'

export interface MapSourceConfig {
  label: string
  icon: string
  description?: string
  source: XYZ | OSM
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string

const MAPTILER_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'

export const TILE_SOURCES: Record<TileSourceId, MapSourceConfig> = {
  maptilerOutdoor: {
    label: 'Outdoor & Приключения',
    icon: 'mdi:hiking',
    description: 'Туристические и горные тропы, отмывка рельефа, изолинии высот и родники',
    source: new XYZ({
      url: `https://api.maptiler.com/maps/outdoor-v2/512/{z}/{x}/{y}@2x.png?key=${MAPTILER_KEY}`,
      tileSize: 512,
      crossOrigin: 'anonymous',
      maxZoom: 20,
      attributions: MAPTILER_ATTRIBUTION,
    }),
  },
  maptilerStreets: {
    label: 'Улицы и Город',
    icon: 'mdi:map-outline',
    description: 'Четкая городская навигация, здания и дорожная сеть',
    source: new XYZ({
      url: `https://api.maptiler.com/maps/streets-v2/512/{z}/{x}/{y}@2x.png?key=${MAPTILER_KEY}`,
      tileSize: 512,
      crossOrigin: 'anonymous',
      maxZoom: 20,
      attributions: MAPTILER_ATTRIBUTION,
    }),
  },
  satellite: {
    label: 'Спутник',
    icon: 'mdi:satellite-variant',
    description: 'Детальные спутниковые снимки местности',
    source: new XYZ({
      url: `https://api.maptiler.com/maps/satellite/512/{z}/{x}/{y}@2x.jpg?key=${MAPTILER_KEY}`,
      tileSize: 512,
      crossOrigin: 'anonymous',
      maxZoom: 20,
      attributions: MAPTILER_ATTRIBUTION,
    }),
  },
  osm: {
    label: 'OpenStreetMap',
    icon: 'mdi:map',
    description: 'Базовая карта сообщества OpenStreetMap',
    source: new OSM({
      crossOrigin: 'anonymous',
    }),
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
    const res = await fetch(`https://api.maptiler.com/maps/outdoor-v2/tiles.json?key=${MAPTILER_KEY}`, {
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
