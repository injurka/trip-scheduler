import type { StyleSpecification } from 'maplibre-gl'

export interface LocationCoords {
  lat: number
  lon: number
}

export interface KitMapRoute {
  id: string
  title?: string
  geometry?: [number, number][]
  color?: string
  isDirect?: boolean
  points?: any[]
  isVisible?: boolean
}

export interface MapMarker {
  id: string
  title?: string
  coords: LocationCoords
  imageUrl?: string
  payload?: any
  color?: string
  pointType?: 'start' | 'via' | 'end' | 'connect' | 'poi'
  scale?: number
  label?: string
  comment?: string
  address?: string
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
