import type TileSource from 'ol/source/Tile'

export interface LocationCoords {
  lat: number
  lon: number
}

export interface MapMarker {
  id: string
  coords: LocationCoords
  imageUrl?: string
  payload?: any
}

/**
 * Опция выбора слоя карты
 */
export interface MapLayerOption {
  id: string
  label: string
  icon: string
  source: TileSource
}

export interface KitMapOptions {
  center: [number, number]
  zoom?: number
  autoPan?: boolean
  initialSource?: TileSource
}

export { TileSource }
