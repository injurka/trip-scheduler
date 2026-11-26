import type { TrackPoint } from '@limiteddissolve/track-processing'
import type { TripStatistics } from './trip-statistics.schema'
import { applyActivityCorrections, applyTrackGeometryCorrections, haversineM, prepareTrack, processPreparedTrack, recordingGapThresholdMs } from '@limiteddissolve/track-processing'

type Correction = Parameters<typeof applyActivityCorrections>[1][number]
type SpeedByActivity = NonNullable<TripStatistics['speedByActivity']>
type SpeedActivity = keyof SpeedByActivity
interface SpeedSample {
  kmh: number
  durationMs: number
}
interface SpeedEdge {
  start: number
  end: number
  kmh: number
}

function collectSpeedEdges(points: ReturnType<typeof prepareTrack>) {
  const sessions = new Map<string, { last?: typeof points[number], edges: SpeedEdge[], cursor: number }>()
  for (const point of points) {
    const session = sessions.get(point.sessionId) ?? { edges: [], cursor: 0 }
    sessions.set(point.sessionId, session)
    const previous = session.last
    session.last = point
    if (!previous || previous.stop || point.stop || previous.accuracy == null || previous.accuracy > 35 || point.accuracy == null || point.accuracy > 35)
      continue
    const durationMs = point.tsUtc - previous.tsUtc
    if (durationMs <= 0 || durationMs > recordingGapThresholdMs(previous))
      continue
    const kmh = haversineM(previous.lat, previous.lng, point.lat, point.lng) * 3600 / durationMs
    if (kmh > 0 && kmh <= 1150)
      session.edges.push({ start: previous.tsUtc, end: point.tsUtc, kmh })
  }
  return sessions
}

function summarizeSpeed(samples: Map<SpeedActivity, SpeedSample[]>): SpeedByActivity {
  const result: SpeedByActivity = {}
  for (const [activity, intervals] of samples) {
    const durationMs = intervals.reduce((sum, interval) => sum + interval.durationMs, 0)
    if (intervals.length < 3 || durationMs < 30_000)
      continue
    intervals.sort((a, b) => a.kmh - b.kmh)
    const percentile = (fraction: number) => {
      let coveredMs = 0
      for (const interval of intervals) {
        coveredMs += interval.durationMs
        if (coveredMs >= durationMs * fraction)
          return interval.kmh
      }
      return intervals.at(-1)!.kmh
    }
    result[activity] = { medianKmh: percentile(0.5), p25Kmh: percentile(0.25), p75Kmh: percentile(0.75) }
  }
  return result
}

/** Match the day player: split UTC days, preserve sessions and apply manual corrections. */
export function summarizeTripTrack(points: TrackPoint[], corrections: Correction[]) {
  const distanceM: TripStatistics['distanceM'] = { walk: 0, bike: 0, vehicle: 0, rail: 0, metro: 0, ship: 0, plane: 0, cable_car: 0, moto: 0, bus: 0, unknown: 0 }
  const days = new Map<string, TrackPoint[]>()
  for (const point of points) {
    const date = new Date(point.tsUtc).toISOString().slice(0, 10)
    const list = days.get(date) ?? []
    list.push(point)
    days.set(date, list)
  }
  let movingDurationMs = 0
  let longestDay: TripStatistics['longestDay'] = null
  const speedSamples = new Map<SpeedActivity, SpeedSample[]>()
  for (const [date, raw] of days) {
    raw.sort((a, b) => a.tsUtc - b.tsUtc)
    const effective = applyTrackGeometryCorrections(raw, corrections)
    const prepared = prepareTrack(effective)
    const speedEdges = collectSpeedEdges(prepared)
    let dayDistance = 0
    for (const { activity, points, features } of applyActivityCorrections(processPreparedTrack(prepared), corrections, effective)) {
      if (activity === 'still')
        continue
      const start = points[0].tsUtc
      const end = points.at(-1)!.tsUtc
      const distance = Math.max(0, features.distanceM)
      distanceM[activity] += distance
      dayDistance += distance
      movingDurationMs += Math.max(0, end - start)

      const session = speedEdges.get(points[0].sessionId)
      if (!session || activity === 'unknown' || end <= start || distance === 0)
        continue
      // Use the same activity boundaries as the summary, with intervals from before map simplification.
      while (session.cursor < session.edges.length && session.edges[session.cursor].end <= start)
        session.cursor++
      const samples = speedSamples.get(activity) ?? []
      for (let i = session.cursor; i < session.edges.length && session.edges[i].start < end; i++) {
        const edge = session.edges[i]
        const durationMs = Math.min(edge.end, end) - Math.max(edge.start, start)
        samples.push({ kmh: edge.kmh, durationMs })
      }
      speedSamples.set(activity, samples)
    }
    if (dayDistance > 0 && (!longestDay || dayDistance > longestDay.distanceM))
      longestDay = { date, distanceM: dayDistance }
  }
  return { distanceM, speedByActivity: summarizeSpeed(speedSamples), movingDurationMs, longestDay, trackedDays: days.size }
}
