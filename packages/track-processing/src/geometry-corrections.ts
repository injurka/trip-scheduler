import type { ActivityCorrection } from './corrections'
import type { TrackPoint } from './index'
import { haversineM } from './index'

export const trackGeometryActions = ['exclude-spike', 'collapse-drift', 'smooth-drift', 'exclude-manual'] as const
export type TrackGeometryAction = typeof trackGeometryActions[number]
export const trackGeometryContextMs = 90_000

type Fix = Pick<TrackPoint, 'tsUtc' | 'lat' | 'lng' | 'accuracy' | 'speed' | 'deviceActivity' | 'deviceActivityConfidence'> & { activity?: string }
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

function inspectExtendedGeometry<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  const local = nearbyFixes(points, startedAt, endedAt)
  const affectedInRange = local.filter(p => p.tsUtc >= startedAt && p.tsUtc <= endedAt && inaccurate(p))
  if (!affectedInRange.length)
    return null

  const firstTs = affectedInRange[0].tsUtc
  const lastTs = affectedInRange.at(-1)!.tsUtc
  const beforeIdx = local.findLastIndex(p => p.tsUtc < firstTs && usable(p))
  const afterIdx = local.findIndex(p => p.tsUtc > lastTs && usable(p))
  if (beforeIdx < 0 || afterIdx < 0)
    return null

  const before = local[beforeIdx]
  const after = local[afterIdx]
  const context = local.slice(beforeIdx, afterIdx + 1)
  if (isRecordingGap(context))
    return null

  const durationMs = after.tsUtc - before.tsUtc
  const anchorDistanceM = distance(before, after)
  const largestDeviationM = affectedInRange.reduce((max, p) => Math.max(max, Math.min(distance(before, p), distance(after, p))), 0)
  const stationaryFixes = context.filter(p => p.deviceActivity === 'still' && (p.deviceActivityConfidence ?? 0) >= 60).length
  const movingFixes = context.filter(p => p.deviceActivity && p.deviceActivity !== 'still' && p.deviceActivity !== 'unknown' && (p.deviceActivityConfidence ?? 0) >= 60).length

  // 1. Multi-point spike excursion (1..4 noisy fixes jumping away between close reliable anchors)
  if (affectedInRange.length <= 4 && durationMs <= 90_000 && anchorDistanceM <= 70
    && largestDeviationM >= Math.max(45, anchorDistanceM * 1.8)) {
    return {
      action: 'exclude-spike' as const,
      affected: affectedInRange,
      replacements: affectedInRange.map(() => null),
      evidence: {
        durationSeconds: Math.round(durationMs / 1000),
        anchorDistanceM: Math.round(anchorDistanceM),
        largestDeviationM: Math.round(largestDeviationM),
        affectedFixes: affectedInRange.length,
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

  // 2. Stationary star-drift even when Android Activity Recognition reported 'unknown'
  if (affectedInRange.length >= 2 && durationMs <= 240_000 && anchorDistanceM <= 28 && largestDeviationM >= 30 && movingFixes === 0
    && context.filter(p => !inaccurate(p)).every(p => distance(before, p) <= 35)) {
    return {
      action: 'collapse-drift' as const,
      affected: affectedInRange,
      replacements: affectedInRange.map(() => ({ lat: before.lat, lng: before.lng, speed: 0 })),
      evidence: {
        durationSeconds: Math.round(durationMs / 1000),
        anchorDistanceM: Math.round(anchorDistanceM),
        largestDeviationM: Math.round(largestDeviationM),
        affectedFixes: affectedInRange.length,
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

  // 3. Extended movement drift smoothing (up to 4 minutes between usable anchors)
  const anchors = local.flatMap((point, index) => usable(point) ? [index] : [])
  const estimates = anchors.slice(1).flatMap((right, index) => {
    const left = anchors[index]
    const a = local[left]
    const b = local[right]
    const elapsed = b.tsUtc - a.tsUtc
    const span = distance(a, b)
    if (elapsed <= 0 || elapsed > 240_000 || span > 1800 || span < 25 || span / (elapsed / 1000) > 36)
      return []
    const slice = local.slice(left, right + 1)
    if (isRecordingGap(slice) || slice.slice(1, -1).some(p => p.deviceActivity === 'still' && (p.deviceActivityConfidence ?? 0) >= 65))
      return []
    const lngDelta = (b.lng - a.lng + 540) % 360 - 180
    const latDelta = b.lat - a.lat
    return local.slice(left + 1, right).flatMap((point) => {
      if (point.tsUtc < startedAt || point.tsUtc > endedAt || !inaccurate(point))
        return []
      const from = distance(a, point)
      const to = distance(b, point)
      const along = (from * from - to * to + span * span) / (2 * span)
      const lateral = Math.sqrt(Math.max(0, from * from - along * along))
      const fraction = (point.tsUtc - a.tsUtc) / elapsed
      const lat = a.lat + latDelta * fraction
      const lng = (a.lng + lngDelta * fraction + 540) % 360 - 180
      const shift = haversineM(point.lat, point.lng, lat, lng)
      const isBacktrackOrOvershoot = along < -12 || along > span + 12
      if ((lateral < 18 && !isBacktrackOrOvershoot) || shift < 18 || shift > 220)
        return []
      const longitudeFromStart = (point.lng - a.lng + 540) % 360 - 180
      const side = Math.sign(lngDelta * (point.lat - a.lat) - latDelta * longitudeFromStart)
      return [{ point, lat, lng, lateralM: Math.round(lateral * side), shiftM: Math.round(shift), anchorDistanceM: Math.round(span), anchorSeconds: Math.round(elapsed / 1000) }]
    })
  })

  if (!estimates.length)
    return null

  return {
    action: 'smooth-drift' as const,
    affected: estimates.map(e => e.point),
    replacements: estimates.map(({ lat, lng }) => ({ lat, lng, speed: null })),
    evidence: {
      durationSeconds: Math.round((endedAt - startedAt) / 1000),
      affectedFixes: estimates.length,
      samples: estimates.slice(0, 24).map(({ point, lateralM, shiftM, anchorDistanceM: spanM, anchorSeconds }) => ({
        second: Math.round((point.tsUtc - startedAt) / 1000),
        accuracyM: Math.round(point.accuracy!),
        lateralM,
        shiftM,
        anchorDistanceM: spanM,
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
  if (legacy) {
    return {
      ...legacy,
      replacements: legacy.affected.map(() => legacy.action === 'exclude-spike'
        ? null
        : { lat: legacy.anchor.lat, lng: legacy.anchor.lng, speed: 0 }),
    }
  }
  return inspectMovementDrift(points, startedAt, endedAt) ?? inspectExtendedGeometry(points, startedAt, endedAt)
}

export interface TrackIssueAiContextPoint<T extends Fix = Fix> {
  offset: number
  inIssueWindow: boolean
  second: number
  dxM: number
  dyM: number
  stepM: number
  accuracyM: number | null
  speedKmh: number | null
  activity: string | null
  deviceActivity: string | null
  deviceActivityConfidence: number | null
  source: T
}

/**
 * Builds anonymized relative trajectory context (in metres and relative seconds, without raw lat/lng or IDs)
 * so LLM can analyze complex urban GPS glitches, select individual outlier offsets, or resolve activity conflicts.
 */
export function buildTrackIssueAiContext<T extends Fix>(points: readonly T[], startedAt: number, endedAt: number) {
  const local = nearbyFixes(points, startedAt, endedAt)
  if (!local.length)
    return null

  const issuePoints = local.filter(p => p.tsUtc >= startedAt && p.tsUtc <= endedAt)
  if (!issuePoints.length)
    return null

  const origin = local[0]
  const baseTs = origin.tsUtc
  const cosLat = Math.max(0.01, Math.cos(origin.lat * Math.PI / 180))
  const stride = Math.max(1, Math.ceil(local.length / 40))
  const sampled = local.filter((p, idx) => idx === 0 || idx === local.length - 1 || (p.tsUtc >= startedAt && p.tsUtc <= endedAt) || idx % stride === 0).slice(0, 48)

  const samples: TrackIssueAiContextPoint<T>[] = sampled.map((p, idx) => {
    const prev = idx > 0 ? sampled[idx - 1] : null
    const lngDiff = ((p.lng - origin.lng + 540) % 360) - 180
    const dxM = Math.round(lngDiff * 111_320 * cosLat)
    const dyM = Math.round((p.lat - origin.lat) * 111_320)
    const stepM = prev ? Math.round(distance(prev, p)) : 0
    return {
      offset: idx,
      inIssueWindow: p.tsUtc >= startedAt && p.tsUtc <= endedAt,
      second: Math.round((p.tsUtc - baseTs) / 1000),
      dxM,
      dyM,
      stepM,
      accuracyM: p.accuracy == null ? null : Math.round(p.accuracy),
      speedKmh: p.speed == null ? null : Math.round(p.speed * 3.6 * 10) / 10,
      activity: p.activity ?? null,
      deviceActivity: p.deviceActivity ?? null,
      deviceActivityConfidence: p.deviceActivityConfidence ?? null,
      source: p,
    }
  })

  const beforeActivities = local.filter(p => p.tsUtc < startedAt && p.activity && p.activity !== 'unknown').map(p => p.activity!)
  const afterActivities = local.filter(p => p.tsUtc > endedAt && p.activity && p.activity !== 'unknown').map(p => p.activity!)

  return {
    durationSeconds: Math.round((endedAt - startedAt) / 1000),
    totalSpanM: Math.round(distance(local[0], local.at(-1)!)),
    prevActivity: beforeActivities.at(-1) ?? null,
    nextActivity: afterActivities[0] ?? null,
    samples,
  }
}

/** A low-accuracy fix can still agree with the recorded route. */
export function hasCoherentTrackGeometry(points: readonly Fix[], startedAt: number, endedAt: number): boolean {
  const local = nearbyFixes(points, startedAt, endedAt)
  const affected = local.filter(p => p.tsUtc >= startedAt && p.tsUtc <= endedAt && inaccurate(p))
  if (!affected.length)
    return false

  const before = local.findLastIndex(p => p.tsUtc < affected[0].tsUtc && usable(p))
  const after = local.findIndex(p => p.tsUtc > affected.at(-1)!.tsUtc && usable(p))
  if (before < 0 || after < 0 || isRecordingGap(local.slice(before, after + 1)))
    return false

  const start = local[before]
  const end = local[after]
  const span = distance(start, end)
  let progress = 0
  return local.slice(before + 1, after).every((point) => {
    const from = distance(start, point)
    if (span < 5)
      return from <= 5

    const to = distance(end, point)
    const along = (from * from - to * to + span * span) / (2 * span)
    const lateral = Math.sqrt(Math.max(0, from * from - along * along))
    if (lateral > 8 || along < progress - 8 || along > span + 8)
      return false

    progress = Math.max(progress, along)
    return true
  })
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

  return 'По замерам не удалось выделить короткое отклонение, которое можно уверенно сгладить.'
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
    if (correction.geometryAction === 'exclude-manual') {
      const points = bySession.get(correction.sessionId) ?? []
      // An individual timestamp is selectable only when it identifies one fix.
      const matching = points.filter(p => p.tsUtc === correction.startedAt)
      if (correction.startedAt === correction.endedAt && matching.length === 1)
        edits.set(matching[0], null)

      continue
    }

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
