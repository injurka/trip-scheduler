import type { ActivityType } from '~/shared/services/tracking/geotrack-client'

export type { ActivityType }

export interface ActivityBreakdownItem {
  activity: ActivityType
  distanceM: number
  durationMs: number
  segmentCount: number
}

export interface DaySummary {
  dayUtc: string
  totalDistanceM: number
  totalDurationMs: number
  byActivity: ActivityBreakdownItem[]
  firstPointTs: number | null
  lastPointTs: number | null
  hasData: boolean
}

export interface IActivityTrackingMetrics {
  overallDistanceM: number
  overallDurationMs: number
  activeDaysCount: number
  totalRecordedDays: number
}
