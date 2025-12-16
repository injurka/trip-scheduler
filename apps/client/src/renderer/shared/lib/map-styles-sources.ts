import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY

export const TILE_SOURCES = {
  maptilerStreets: {
    label: 'Улицы',
    icon: 'mdi:road-variant',
    source: new XYZ({
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${mapTilerKey}`,
      attributions: '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
      tileSize: 512,
      maxZoom: 22,
    }),
  },
  maptilerTopo: {
    label: 'Топо',
    icon: 'mdi:terrain',
    source: new XYZ({
      url: `https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}@2x.png?key=${mapTilerKey}`,
      attributions: '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
      tileSize: 512,
      maxZoom: 22,
    }),
  },
  satellite: {
    label: 'Спутник',
    icon: 'mdi:satellite-variant',
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Tiles &copy; Esri',
      maxZoom: 19,
    }),
  },
  toner: {
    label: 'Ч/Б',
    icon: 'mdi:map',
    source: new XYZ({
      url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
      attributions: '&copy; Stadia Maps, &copy; OpenMapTiles &copy; OpenStreetMap',
    }),
  },
  osm: {
    label: 'OSM',
    icon: 'mdi:map-outline',
    source: new OSM(),
  },
}

export type TileSourceId = keyof typeof TILE_SOURCES

/**
 * Проверяет доступность сервиса MapTiler.
 */
export async function checkMapTilerAvailability(): Promise<boolean> {
  if (!mapTilerKey) {
    console.warn('MapTiler API key is missing.')
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(`https://api.maptiler.com/maps/streets-v2/0/0/0@2x.png?key=${mapTilerKey}&_=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      return true
    }
    return false
  }
  catch (e) {
    console.warn('MapTiler недоступен (network error), переключаемся на OSM.', e)
    return false
  }
}
