import type { ActivityType } from '~/shared/services/tracking/track-processing'

export interface DayPoint {
  clientPointId: string
  tsUtc: number
  lat: number
  lng: number
  altitude?: number | null
  speed: number | null
  accuracy: number | null
  bearing?: number | null
  activity: ActivityType
  sessionId: string
}

export interface DaySegment {
  id: string
  sessionId: string
  activity: ActivityType
  confidence: number
  startedAt: number
  endedAt: number
  distanceM: number
  pointCount: number
  geometry: [number, number][]
}

export interface DayData {
  points: DayPoint[]
  segments: DaySegment[]
}

export interface RenderSegment {
  activity: ActivityType
  points: Array<{ tsUtc: number, lat: number, lng: number }>
  t0: number
  t1: number
}

export interface SelectedPointInfo {
  point: DayPoint
  index: number
  total: number
}

export type ViewMode = 'route' | 'points'
export type TimezoneMode = 'track' | 'device'

export interface PointStatusBadge {
  type: 'flight' | 'warning' | 'valid'
  icon: string
  label: string
}

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  still: '#9e9e9e',
  walk: '#4caf50',
  bike: '#ff9800',
  vehicle: '#2196f3',
  rail: '#9c27b0',
  unknown: '#607d8b',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  unknown: 'Движение',
}

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  unknown: 'mdi:crosshairs-question',
}

export const SPEED_BASE = 150
export const SPEED_MULTIPLIERS = [1, 2, 5, 10, 20] as const
