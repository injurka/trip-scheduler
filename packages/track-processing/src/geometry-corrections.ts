import type { ActivityCorrection } from './corrections'
import type { TrackPoint } from './index'
import { haversineM } from './index'

export const trackGeometryActions = ['exclude-spike', 'collapse-drift', 'smooth-drift'] as const
export type TrackGeometryAction = typeof trackGeometryActions[number]
export const trackGeometryContextMs = 60_000

type Fix = Pick<TrackPoint, 'tsUtc' | 'lat' | 'lng' | 'accuracy' | 'speed' | 'deviceActivity' | 'deviceActivityConfidence'>
type Interval = Pick<ActivityCorrection, 'sessionId' | 'startedAt' | 'endedAt'>

const distance = (a: Fix, b: Fix) => haversineM(a.lat, a.lng, b.lat, b.lng)
const reliable = (p: Fix) => p.accuracy != null && p.accuracy <= 25
const usable = (p: Fix) => p.accuracy != null && p.accuracy <= 35
const inaccurate = (p: Fix) => p.accuracy != null && p.accuracy > 35

function inspectLegacyGeometry<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
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

function nearbyFixes<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  return points.filter(p => p.tsUtc >= startedAt - trackGeometryContextMs && p.tsUtc <= endedAt + trackGeometryContextMs)
}

function isRecordingGap(points: readonly Fix[]) {
  return points.some((point, index) => index > 0 && point.tsUtc - points[index - 1].tsUtc > 30_000)
}

function movementEstimate<T extends Fix>(before: T, after: T, points: T[], startedAt: number, endedAt: number) {
  const elapsed = after.tsUtc - before.tsUtc
  const span = distance(before, after)
  // Short, observed stretches only. A noisy section is not evidence of a shortcut.
  if (elapsed <= 0 || elapsed > 75_000 || span > 600 || span < Math.max(30, (before.accuracy ?? 0) + (after.accuracy ?? 0)) || span / (elapsed / 1000) > 32)
    return []

  const observed = [before, ...points, after]
  if (isRecordingGap(observed) || points.some(p => p.deviceActivity === 'still' && (p.deviceActivityConfidence ?? 0) >= 60))
    return []

  // Longitude arithmetic wraps at the date line. The triangle height estimates
  // deviation from the path independently of when the fix was recorded.
  const lngDelta = (after.lng - before.lng + 540) % 360 - 180
  const latDelta = after.lat - before.lat
  return points.flatMap((point) => {
    if (point.tsUtc <= before.tsUtc || point.tsUtc >= after.tsUtc || point.tsUtc < startedAt || point.tsUtc > endedAt || !inaccurate(point))
      return []

    const from = distance(before, point)
    const to = distance(after, point)
    const along = (from * from - to * to + span * span) / (2 * span)
    const lateral = Math.sqrt(Math.max(0, from * from - along * along))
    const fraction = (point.tsUtc - before.tsUtc) / elapsed
    const lat = before.lat + latDelta * fraction
    const lng = (before.lng + lngDelta * fraction + 540) % 360 - 180
    const shift = haversineM(point.lat, point.lng, lat, lng)
    const uncertainty = point.accuracy!
    if (along < -uncertainty / 2 || along > span + uncertainty / 2
      || lateral < Math.max(25, uncertainty * 0.5)
      || shift > Math.min(180, uncertainty * 1.2)) {
      return []
    }

    const longitudeFromStart = (point.lng - before.lng + 540) % 360 - 180
    const side = Math.sign(lngDelta * (point.lat - before.lat) - latDelta * longitudeFromStart)
    return [{ point, lat, lng, lateralM: Math.round(lateral * side), shiftM: Math.round(shift), anchorDistanceM: Math.round(span), anchorSeconds: Math.round(elapsed / 1000) }]
  })
}

function inspectMovementDrift<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  const local = nearbyFixes(points, startedAt, endedAt)
  const anchors = local.flatMap((point, index) => usable(point) ? [index] : [])
  const estimates = anchors.slice(1).flatMap((right, index) => {
    const left = anchors[index]
    return movementEstimate(local[left], local[right], local.slice(left + 1, right), startedAt, endedAt)
  })
  if (!estimates.length)
    return null

  return {
    action: 'smooth-drift' as const,
    affected: estimates.map(estimate => estimate.point),
    replacements: estimates.map(({ lat, lng }) => ({ lat, lng, speed: null })),
    evidence: {
      durationSeconds: Math.round((endedAt - startedAt) / 1000),
      affectedFixes: estimates.length,
      samples: estimates.slice(0, 24).map(({ point, lateralM, shiftM, anchorDistanceM, anchorSeconds }) => ({
        second: Math.round((point.tsUtc - startedAt) / 1000),
        accuracyM: Math.round(point.accuracy!),
        lateralM,
        shiftM,
        anchorDistanceM,
        anchorSeconds,
        speedMps: point.speed,
        deviceActivity: point.deviceActivity,
        deviceActivityConfidence: point.deviceActivityConfidence,
      })),
    },
  }
}

/** Prefer existing rules so saved corrections keep the same geometry. */
export function inspectTrackGeometry<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  const legacy = inspectLegacyGeometry(points, startedAt, endedAt)
  if (!legacy)
    return inspectMovementDrift(points, startedAt, endedAt)

  return {
    ...legacy,
    replacements: legacy.affected.map(() => legacy.action === 'exclude-spike'
      ? null
      : { lat: legacy.anchor.lat, lng: legacy.anchor.lng, speed: 0 }),
  }
}

export function explainTrackGeometry<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number): string {
  const local = nearbyFixes(points, startedAt, endedAt)
  const affected = local.filter(p => p.tsUtc >= startedAt && p.tsUtc <= endedAt && inaccurate(p))
  if (!affected.length)
    return 'На сервере нет неточных замеров для этого участка. Если трек только что записан, дождитесь синхронизации.'

  const first = affected[0].tsUtc
  const last = affected.at(-1)!.tsUtc
  const before = local.findLastIndex(p => p.tsUtc < first && usable(p))
  const after = local.findIndex(p => p.tsUtc > last && usable(p))
  if (before < 0 || after < 0)
    return 'С одной или обеих сторон нет достаточно точных GPS-точек. По этим данным нельзя определить, куда сместить маршрут.'

  if (isRecordingGap(local.slice(before, after + 1)))
    return 'Между соседними замерами слишком большой интервал для сглаживания. Маршрут в этом промежутке может быть другим.'

  return 'По замерам не удалось выделить короткое отклонение, которое можно уверенно сгладить. Можно посмотреть участок на карте.'
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
    for (const [index, point] of result.affected.entries()) {
      const replacement = result.replacements[index]
      edits.set(point, replacement ? { ...point, ...replacement } : null)
    }
  }

  return edits.size ? raw.flatMap(point => edits.has(point) ? edits.get(point) ?? [] : point) : raw
}
