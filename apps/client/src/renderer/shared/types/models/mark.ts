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
  photos?: File[] // Временно оставляем, но загрузку файлов лучше делать через file.repository
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
  coordinates: [number, number] // [lon, lat]
}

export interface MarkUser {
  id: string // Было number
  username: string
  email?: string
  avatar?: string
}

export interface Mark {
  id: string // Было number
  markName: string
  ownerId: string // Было number
  geom: MarkGeo
  startAt: string
  endAt: string
  duration?: number
  isEnded: boolean
  category: MarkCategory
  additionalInfo?: string
  photo?: string[]
  owner?: MarkUser
}

export interface ScreenPosition {
  leftTop: { lat: number, lon: number }
  center: { lat: number, lon: number }
  rightBottom: { lat: number, lon: number }
}
