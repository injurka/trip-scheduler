import type { EActivitySectionType } from '~/shared/types/models/activity'

export type Coordinate = [number, number]

export type PointType = 'poi' | 'start' | 'via' | 'end' | 'connect'

export interface MarkerStyle {
  iconUrl?: string
  color?: string
  scale?: number
  opacity?: number
  zIndex?: number
}

export interface MapPoint {
  id: string
  coordinates: Coordinate
  type: PointType
  style?: MarkerStyle
  address?: string
  comment?: string
}

export type TransportMode = 'foot' | 'bike' | 'car'

export interface MapRoute {
  id: string
  title: string
  points: MapPoint[]
  color?: string
  transportMode?: TransportMode
  distance?: number
  duration?: number
  geometry?: Coordinate[]
  isVisible: boolean
  isFetching?: boolean
  isDirect?: boolean
}

export interface ActivitySectionGeolocation {
  id: string
  type: EActivitySectionType.GEOLOCATION
  isAttached?: boolean
  title?: string
  icon?: string

  points: MapPoint[]
  routes: MapRoute[]
  center?: Coordinate
  zoom?: number
}

export interface GeolocationMapOptions {
  container: string | HTMLElement
  center: [number, number]
  zoom?: number
  interactive?: boolean
}

export interface OSRMResponse {
  code: string
  routes: Array<{
    legs: Array<{
      steps: any[]
      weight: number
      summary: string
      duration: number
      distance: number
    }>
    weight_name: string
    weight: number
    duration: number
    distance: number
    geometry: string
  }>
  waypoints: Array<{
    hint: string
    location: [number, number]
    name: string
    distance: number
  }>
}
