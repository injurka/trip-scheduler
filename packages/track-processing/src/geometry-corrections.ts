import type { ActivityCorrection } from './corrections'
import type { TrackPoint } from './index'
import { haversineM } from './index'

export const trackGeometryActions = ['exclude-spike', 'collapse-drift'] as const
export type TrackGeometryAction = typeof trackGeometryActions[number]

type Fix = Pick<TrackPoint, 'tsUtc' | 'lat' | 'lng' | 'accuracy' | 'speed' | 'deviceActivity' | 'deviceActivityConfidence'>
type Interval = Pick<ActivityCorrection, 'sessionId' | 'startedAt' | 'endedAt'>

const distance = (a: Fix, b: Fix) => haversineM(a.lat, a.lng, b.lat, b.lng)
const reliable = (p: Fix) => p.accuracy != null && p.accuracy <= 25
const inaccurate = (p: Fix) => p.accuracy != null && p.accuracy > 35

/** Compare observed fixes and return only actions with enough local evidence. */
export function inspectTrackGeometry<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  const local = points.filter(p => p.tsUtc >= startedAt - 30_000 && p.tsUtc <= endedAt + 30_000)
  const before = local.findLast(p => p.tsUtc < startedAt && reliable(p))
  const after = local.find(p => p.tsUtc >= endedAt && p.tsUtc > startedAt && reliable(p))
  const affected = local.filter(p => p.tsUtc >= startedAt && p.tsUtc <= endedAt && inaccurate(p))
  if (!before || !after || affected.length === 0)
    return null

  const context = local.filter(p => p.tsUtc >= before.tsUtc && p.tsUtc <= after.tsUtc)
  if (context.some((point, index) => index > 0 && point.tsUtc - context[index - 1].tsUtc > 30_000))
    return null

  const anchorDistanceM = distance(before, after)
  const largestDeviationM = affected.reduce((max, p) => Math.max(max, Math.min(distance(before, p), distance(after, p))), 0)
  const stationaryFixes = context.filter(p => p.deviceActivity === 'still' && (p.deviceActivityConfidence ?? 0) >= 60).length
  const movingFixes = context.filter(p => p.deviceActivity && p.deviceActivity !== 'still' && p.deviceActivity !== 'unknown' && (p.deviceActivityConfidence ?? 0) >= 60).length
  const durationMs = after.tsUtc - before.tsUtc
  let action: TrackGeometryAction
  if (affected.length === 1 && context.length === 3
    && durationMs <= 30_000 && largestDeviationM >= 70 && anchorDistanceM <= Math.min(45, largestDeviationM / 3)) {
    action = 'exclude-spike'
  }
  else if (affected.length >= 2 && anchorDistanceM <= 25 && largestDeviationM >= 35 && stationaryFixes >= 2 && movingFixes === 0
    && context.filter(p => !inaccurate(p)).every(p => distance(before, p) <= 30)) {
    action = 'collapse-drift'
  }
  else {
    return null
  }
  return {
    action,
    anchor: before,
    affected,
    evidence: {
      durationSeconds: Math.round(durationMs / 1000),
      anchorDistanceM: Math.round(anchorDistanceM),
      largestDeviationM: Math.round(largestDeviationM),
      affectedFixes: affected.length,
      stationaryFixes,
      movingFixes,
      samples: context.slice(0, 24).map(p => ({
        second: Math.round((p.tsUtc - before.tsUtc) / 1000),
        distanceFromStartM: Math.round(distance(before, p)),
        accuracyM: p.accuracy == null ? null : Math.round(p.accuracy),
        speedMps: p.speed,
        deviceActivity: p.deviceActivity,
        deviceActivityConfidence: p.deviceActivityConfidence,
      })),
    },
  }
}

export function applyTrackGeometryCorrections<T extends Fix & Pick<TrackPoint, 'sessionId'>>(raw: T[], corrections: readonly (Interval & { geometryAction?: TrackGeometryAction | null })[]): T[] {
  const geometry = corrections.filter(c => c.geometryAction)
  if (!geometry.length)
    return raw

  const bySession = new Map<string, T[]>()
  for (const point of raw) {
    const session = bySession.get(point.sessionId) ?? []
    session.push(point)
    bySession.set(point.sessionId, session)
  }
  for (const points of bySession.values())
    points.sort((a, b) => a.tsUtc - b.tsUtc)

  const edits = new Map<T, T | null>()
  for (const correction of geometry) {
    const result = inspectTrackGeometry(bySession.get(correction.sessionId) ?? [], correction.startedAt, correction.endedAt)
    if (!result || result.action !== correction.geometryAction)
      continue
    for (const point of result.affected) {
      edits.set(point, result.action === 'exclude-spike'
        ? null
        : {
            ...point,
            lat: result.anchor.lat,
            lng: result.anchor.lng,
            speed: 0,
          })
    }
  }

  return edits.size ? raw.flatMap(point => edits.has(point) ? edits.get(point) ?? [] : point) : raw
}
