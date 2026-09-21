export interface ActivitySectionDescription {
  id: string
  type: 'description'
  text: string
  isAttached?: boolean
  title?: string | null
  icon?: string | null
  color?: string | null
}

export interface ActivitySectionGallery {
  id: string
  type: 'gallery'
  imageUrls: string[]
  isAttached?: boolean
  title?: string | null
  icon?: string | null
  color?: string | null
}

export interface GeolocationPoint {
  id: string
  coordinates: [number, number]
  type: 'poi' | 'start' | 'via' | 'end' | 'connect'
  address?: string | null
  comment?: string | null
  externalUrl?: string | null
  style?: {
    iconUrl?: string
    color?: string
    scale?: number
  } | null
}

export interface ActivitySectionGeolocation {
  id: string
  type: 'geolocation'
  points: GeolocationPoint[]
  routes: any[]
  center?: [number, number] | null
  zoom?: number | null
  title?: string
  icon?: string
}

export interface MetroRide {
  id: string
  startStationId: string | null
  startStation: string
  endStationId: string | null
  endStation: string
  lineId: string | null
  lineName: string
  lineNumber: string | null
  lineColor: string
  direction: string
  stops: number
}

export interface ActivitySectionMetro {
  id: string
  type: 'metro'
  title?: string | null
  isAttached?: boolean
  icon?: string | null
  color?: string | null
  mode: 'free' | 'city'
  systemId: string | null
  rides: MetroRide[]
}

export interface BusRide {
  id: string
  from: string
  to: string
  route: string
  code: string | null
  color: string
  operator: string | null
  direction: string
  stops: number
  walk: string | null
  links?: string[]
}

export interface ActivitySectionBus {
  id: string
  type: 'bus'
  title?: string | null
  isAttached?: boolean
  icon?: string | null
  color?: string | null
  rides: BusRide[]
}

export interface ActivitySectionBooking {
  id: string
  type: 'booking'
  bookingId: string
}

export type ActivitySection
  = | ActivitySectionDescription
    | ActivitySectionGallery
    | ActivitySectionGeolocation
    | ActivitySectionMetro
    | ActivitySectionBus
    | ActivitySectionBooking

export interface ActivityPayload {
  id?: string
  startTime: string
  endTime: string
  title: string
  tag: 'transport' | 'walk' | 'food' | 'attraction' | 'relax' | 'activity'
  sections?: ActivitySection[]
}
