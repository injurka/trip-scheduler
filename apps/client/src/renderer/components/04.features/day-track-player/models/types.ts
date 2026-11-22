import type { ActivityCorrection } from '@limiteddissolve/track-processing'
import type { ActivityType } from '~/shared/services/tracking/track-processing'

export interface DayPoint {
  samplingIntervalMs?: number | null
  localPending?: boolean
  clientPointId: string
  tsUtc: number
  lat: number
  lng: number
  altitude?: number | null
  speed: number | null
  accuracy: number | null
  bearing?: number | null
  activity: ActivityType
  recordedActivity?: ActivityType
  activityConfidence?: number
  activitySource?: 'automatic' | 'manual'
  sessionId: string
  deviceActivity?: ActivityType | null
  deviceActivityConfidence?: number | null
  stop?: import('@limiteddissolve/track-processing').TrackStop
}

export interface DaySegment {
  activitySource?: 'automatic' | 'manual'
  id: string
  sessionId: string
  activity: ActivityType
  confidence: number
  startedAt: number
  endedAt: number
  distanceM: number
  pointCount: number
  geometry: [number, number][]
  simplifiedPoints?: Array<{ tsUtc: number, lat: number, lng: number }>
}

export interface DayData {
  ownerId?: string
  localError?: string
  localPendingCount?: number
  /** Worker-prepared routes for a local preview; never part of a server mutation. */
  preparedRenderSegments?: RenderSegment[]
  timeZone?: string
  canEdit?: boolean
  points: DayPoint[]
  rawPoints?: DayPoint[]
  corrections?: ActivityCorrection[]
  segments: DaySegment[]
}

export interface RenderSegment {
  activitySource?: 'automatic' | 'manual'
  activity: ActivityType
  points: Array<{ tsUtc: number, lat: number, lng: number }>
  t0: number
  t1: number
  geometry?: [number, number][]
}

export interface SelectedPointInfo {
  point: DayPoint
  index: number
  total: number
}

export type TrackPhotoSource = 'gps' | 'interpolated' | 'stop' | 'unlocated'

export interface TrackPhoto {
  id: string
  memoryId: string
  title?: string
  comment?: string | null
  imageUrl: string
  thumbnailUrl: string
  thumbhash?: string | null
  lat: number
  lng: number
  source: 'gps' | 'interpolated' | 'stop'
  tsUtc: number
  mediaType?: 'image' | 'video'
  originalMemory?: unknown
}

export interface TrackPhotoCluster {
  id: string
  lat: number
  lng: number
  photos: TrackPhoto[]
  count: number
  representativePhoto: TrackPhoto
}

export type RouteVisibility = 'full' | 'elapsed' | 'recent'

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
  metro: '#7959d5',
  ship: '#008f89',
  plane: '#a7548d',
  cable_car: '#9b631e',
  moto: '#d04a71',
  unknown: '#607d8b',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  metro: 'Метро',
  ship: 'Судно',
  plane: 'Самолёт',
  cable_car: 'Канатная дорога',
  moto: 'Мото',
  unknown: 'Неизвестно',
}

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  metro: 'mdi:subway-variant',
  ship: 'mdi:ferry',
  plane: 'mdi:airplane',
  cable_car: 'mdi:gondola',
  moto: 'mdi:motorbike',
  unknown: 'mdi:crosshairs-question',
}

export const SPEED_BASE = 150
export const SPEED_MULTIPLIERS = [1, 2, 5, 10, 20] as const
