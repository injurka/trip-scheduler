import type { StyleSpecification } from 'maplibre-gl'

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
  style?: string | StyleSpecification
}

export interface KitMapOptions {
  center: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  autoPan?: boolean
  initialStyle?: string | StyleSpecification
}
