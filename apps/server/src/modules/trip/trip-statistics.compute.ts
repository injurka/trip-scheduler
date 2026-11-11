import type { TrackPoint } from '@limiteddissolve/track-processing'
import type { TripStatistics } from './trip-statistics.schema'
import { applyActivityCorrections, processDayTrack } from '@limiteddissolve/track-processing'

type Correction = Parameters<typeof applyActivityCorrections>[1][number]

/** Match the day player: split UTC days, preserve sessions and apply manual corrections. */
export function summarizeTripTrack(points: TrackPoint[], corrections: Correction[]) {
  const distanceM: TripStatistics['distanceM'] = { walk: 0, bike: 0, vehicle: 0, rail: 0, unknown: 0 }
  const days = new Map<string, TrackPoint[]>()
  for (const point of points) {
    const date = new Date(point.tsUtc).toISOString().slice(0, 10)
    const list = days.get(date) ?? []
    list.push(point)
    days.set(date, list)
  }
  let movingDurationMs = 0
  let longestDay: TripStatistics['longestDay'] = null
  for (const [date, raw] of days) {
    raw.sort((a, b) => a.tsUtc - b.tsUtc)
    let dayDistance = 0
    for (const segment of applyActivityCorrections(processDayTrack(raw), corrections, raw)) {
      if (segment.activity === 'still')
        continue
      const distance = Math.max(0, segment.features.distanceM)
      distanceM[segment.activity] += distance
      dayDistance += distance
      movingDurationMs += Math.max(0, segment.points.at(-1)!.tsUtc - segment.points[0].tsUtc)
    }
    if (dayDistance > 0 && (!longestDay || dayDistance > longestDay.distanceM))
      longestDay = { date, distanceM: dayDistance }
  }
  return { distanceM, movingDurationMs, longestDay, trackedDays: days.size }
}
