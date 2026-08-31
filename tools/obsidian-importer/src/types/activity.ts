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
  drawnRoutes: any[]
  center?: [number, number] | null
  zoom?: number | null
  title?: string
  icon?: string
}

export interface ActivitySectionMetro {
  id: string
  type: 'metro'
  mode: 'free' | 'city'
  systemId?: string | null
  rides: any[]
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
    | ActivitySectionBooking

export interface ActivityPayload {
  id?: string
  startTime: string
  endTime: string
  title: string
  tag: 'transport' | 'walk' | 'food' | 'attraction' | 'relax' | 'activity'
  sections?: ActivitySection[]
}
