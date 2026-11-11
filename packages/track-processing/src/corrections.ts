import type { TrackActivityType, TrackPoint, TrackSegment } from './index'
import { windowFeatures } from './index'

export interface ActivityCorrection {
  id: string
  sessionId: string
  startedAt: number
  endedAt: number
  activity: TrackActivityType
  createdAt: number
}

function pointAt(points: TrackPoint[], time: number): TrackPoint {
  const right = points.findIndex(point => point.tsUtc >= time)
  if (right <= 0)
    return { ...points[0], tsUtc: time }
  const a = points[right - 1]
  const b = points[right]
  const fraction = (time - a.tsUtc) / Math.max(1, b.tsUtc - a.tsUtc)
  return { ...a, tsUtc: time, lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction }
}

/** Overlay choices in creation order after automatic processing; the last overlapping choice wins. */
export function applyActivityCorrections(segments: TrackSegment[], corrections: ActivityCorrection[], rawPoints: TrackPoint[] = []): TrackSegment[] {
  const ordered = [...corrections].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  const corrected = segments.flatMap((segment) => {
    const points = segment.points
    const start = points[0].tsUtc
    const end = points[points.length - 1].tsUtc
    const pointCorrections = ordered.filter(c => c.sessionId === points[0].sessionId && c.startedAt === c.endedAt && c.startedAt >= start && c.startedAt <= end)
    const relevant = ordered.filter(c => c.sessionId === points[0].sessionId && c.startedAt < end && c.endedAt > start)
    if (start === end) {
      const correction = ordered.findLast(c => c.sessionId === points[0].sessionId && c.startedAt <= start && c.endedAt >= end)
      return [{ ...segment, activity: correction?.activity ?? segment.activity, confidence: correction ? 1 : segment.confidence, activitySource: correction ? 'manual' as const : segment.activitySource }]
    }
    if (!relevant.length && !pointCorrections.length)
      return [segment]
    const geometryDistance = windowFeatures(points).distanceM
    const boundaries = [...new Set([start, end, ...relevant.flatMap(c => [Math.max(start, c.startedAt), Math.min(end, c.endedAt)])])].sort((a, b) => a - b)
    const result = boundaries.slice(0, -1).map((from, index) => {
      const to = boundaries[index + 1]
      const correction = relevant.findLast(c => c.startedAt <= from && c.endedAt >= to)
      const clipped = [pointAt(points, from), ...points.filter(p => p.tsUtc > from && p.tsUtc < to), pointAt(points, to)]
      const features = windowFeatures(clipped)
      // Preserve the measured total using spatial proportions; GPS stops retain zero distance.
      features.distanceM = geometryDistance > 0 ? features.distanceM * segment.features.distanceM / geometryDistance : 0
      return { ...segment, points: clipped, features, activity: correction?.activity ?? segment.activity, confidence: correction ? 1 : segment.confidence, activitySource: correction ? 'manual' as const : segment.activitySource }
    })
    for (const correction of pointCorrections) {
      const latest = ordered.findLast(c => c.sessionId === correction.sessionId && c.startedAt <= correction.startedAt && c.endedAt >= correction.endedAt)
      if (latest?.id !== correction.id)
        continue
      const point = rawPoints.find(p => p.sessionId === correction.sessionId && p.tsUtc === correction.startedAt) ?? pointAt(points, correction.startedAt)
      result.push({ ...segment, points: [point], features: windowFeatures([point]), activity: correction.activity, confidence: 1, activitySource: 'manual' })
    }
    return result.sort((a, b) => a.points[0].tsUtc - b.points[0].tsUtc)
  })
  for (const correction of ordered.filter(c => c.startedAt === c.endedAt)) {
    const point = rawPoints.find(p => p.sessionId === correction.sessionId && p.tsUtc === correction.startedAt)
    if (!point || corrected.some(s => s.points[0].sessionId === point.sessionId && s.points[0].tsUtc <= point.tsUtc && s.points.at(-1)!.tsUtc >= point.tsUtc))
      continue
    const latest = ordered.findLast(c => c.sessionId === point.sessionId && c.startedAt <= point.tsUtc && c.endedAt >= point.tsUtc)!
    corrected.push({ points: [point], features: windowFeatures([point]), activity: latest.activity, confidence: 1, activitySource: 'manual' })
  }
  return corrected.sort((a, b) => a.points[0].tsUtc - b.points[0].tsUtc)
}

/** Map effective segment labels back to original fixes without touching measurement values. */
export function annotateTrackPoints<T extends Pick<TrackPoint, 'sessionId' | 'tsUtc' | 'activity'>>(points: T[], segments: TrackSegment[], corrections: ActivityCorrection[] = []): Array<T & { recordedActivity: TrackActivityType, activityConfidence: number, activitySource: 'automatic' | 'manual' }> {
  const bySession = new Map<string, TrackSegment[]>()
  for (const segment of segments) {
    const sessionId = segment.points[0].sessionId
    const list = bySession.get(sessionId) ?? []
    list.push(segment)
    bySession.set(sessionId, list)
  }
  const ordered = [...corrections].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  return points.map((point) => {
    const list = bySession.get(point.sessionId) ?? []
    let low = 0
    let high = list.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (list[mid].points[0].tsUtc <= point.tsUtc)
        low = mid + 1
      else
        high = mid
    }
    const candidate = list[low - 1]
    const segment = candidate && candidate.points.at(-1)!.tsUtc >= point.tsUtc ? candidate : list.slice(0, Math.max(0, low - 1)).findLast(s => s.points[0].tsUtc <= point.tsUtc && s.points.at(-1)!.tsUtc >= point.tsUtc)
    const correction = ordered.findLast(c => c.sessionId === point.sessionId && c.startedAt <= point.tsUtc && c.endedAt >= point.tsUtc)
    if (correction)
      return { ...point, recordedActivity: point.activity, activity: correction.activity, activityConfidence: 1, activitySource: 'manual' as const }
    return { ...point, recordedActivity: point.activity, activity: segment?.activity ?? 'unknown', activityConfidence: segment?.confidence ?? 0, activitySource: segment?.activitySource ?? 'automatic' }
  })
}
