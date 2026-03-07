export interface GetMarksParams {
  screen: ScreenPosition
  zoomlevel: number
  startAt: string
  endAt: string
}

export interface CreateMarkInput {
  markName: string
  latitude: number
  longitude: number
  categoryId: number
  additionalInfo?: string
  startAt?: string // ISO date string
  duration?: number // hours
  photos?: File[]
}

export interface Mark {
  id: number
  markName: string
  ownerId: number
  geom: MarkGeo
  endAt: string // ISO date string
  isEnded: boolean
  category: MarkCategory
  additionalInfo?: string
  photo?: string[]
  owner?: MarkUser
}

export interface MarkCategory {
  id: number
  categoryName: string
  color: string
  icon: string
}

export interface MarkGeo {
  bbox: number[] | null
  type: 'Point'
  coordinates: [number, number]
}

export interface MarkUser {
  id: number
  username: string
  email?: string
  avatar?: string
}

export interface Mark {
  id: number
  markName: string
  ownerId: number
  geom: MarkGeo
  endAt: string
  isEnded: boolean
  category: MarkCategory
  additionalInfo?: string
  photo?: string[]
  owner?: MarkUser
}

export interface ScreenPosition {
  leftTop: {
    lat: number
    lon: number
  }
  center: {
    lat: number
    lon: number
  }
  rightBottom: {
    lat: number
    lon: number
  }
}
