export type { ActivityBreakdownItem, ActivityType, DaySummary } from '~/components/03.domain/activity-day-summary/types'

export interface IActivityTrackingMetrics {
  overallDistanceM: number
  overallDurationMs: number
  activeDaysCount: number
  totalRecordedDays: number
}
