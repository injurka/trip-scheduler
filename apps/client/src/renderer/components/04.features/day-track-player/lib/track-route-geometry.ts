import type { DayData, RenderSegment } from '../models/types'
import { haversineM, splitTrackIntoLegs } from '~/shared/services/tracking/track-processing'
import { clipTrackLeg } from './track-time-window'

/** Use detailed prepared fixes for display; server simplification remains classification/storage data. */
export function detailedRouteSegments(data: DayData): RenderSegment[] {
  const sessions = new Map<string, DayData['points']>()

  for (const point of data.points) {
    const list = sessions.get(point.sessionId) ?? []
    list.push(point)
    sessions.set(point.sessionId, list)
  }

  const legsBySession = new Map([...sessions].map(([id, points]) => [id, splitTrackIntoLegs(points)]))

  return data.segments.flatMap((segment) => {
    const legs = legsBySession.get(segment.sessionId) ?? []

    return legs.flatMap((leg) => {
      const points = clipTrackLeg(leg.points, segment.startedAt, segment.endedAt)

      if (points.length < 2)
        return []

      return [{
        activity: segment.activity,
        activitySource: segment.activitySource,
        points,
        t0: points[0].tsUtc,
        t1: points.at(-1)!.tsUtc,
      }]
    })
  })
}

interface Point { lat: number, lng: number }
type Coordinate = [number, number]
const coordinate = (p: Point): Coordinate => [p.lng, p.lat]
const mix = (a: Point, b: Point, t: number): Point => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })

function canRoundCorner(before: number, after: number, cosine: number): boolean {
  return before >= 2 && after >= 2 && before <= 50 && after <= 50
    && Number.isFinite(cosine) && cosine <= 0.985 && cosine >= -0.5
}

/**
 * Local quadratic corner rounding: trims at most 1 m, never overshoots the control triangle.
 * Endpoints, hairpins, duplicate fixes and sparse observations remain exact.
 * Rendering only: timestamps, source points and measured distance are unchanged.
 */
export function roundedRouteCoordinates(points: Point[]): Coordinate[] {
  if (points.length < 3)
    return points.map(coordinate)

  const out: Coordinate[] = [coordinate(points[0])]

  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]
    const b = points[i]
    const c = points[i + 1]
    const before = haversineM(
      a.lat,
      a.lng,
      b.lat,
      b.lng,
    )
    const after = haversineM(
      b.lat,
      b.lng,
      c.lat,
      c.lng,
    )
    const scale = Math.cos(b.lat * Math.PI / 180)
    const ux = (b.lng - a.lng) * scale
    const uy = b.lat - a.lat
    const vx = (c.lng - b.lng) * scale
    const vy = c.lat - b.lat
    const cosine = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))

    if (!canRoundCorner(before, after, cosine)) {
      out.push(coordinate(b))
      continue
    }

    const trim = Math.min(1, before * 0.2, after * 0.2)
    const entry = mix(b, a, trim / before)
    const exit = mix(b, c, trim / after)
    out.push(coordinate(entry))

    for (const t of [0.25, 0.5, 0.75])
      out.push(coordinate(mix(mix(entry, b, t), mix(b, exit, t), t)))

    out.push(coordinate(exit))
  }

  out.push(coordinate(points.at(-1)!))

  return out
}
