import type {
  ActivityCorrection,
  TrackPoint,
} from '@limiteddissolve/track-processing'
import type { DayData } from '../models/types'
import {
  annotateTrackPoints,
  applyActivityCorrections,
  prepareTrack,
  processDayTrack,
} from '@limiteddissolve/track-processing'
import { detailedRouteSegments } from './track-route-geometry'

/** Lives in the worker; the loaded day's automatic classification is reused across edits. */
export function createTrackPreviewTask() {
  let base: DayData
  let raw: TrackPoint[]
  let prepared: DayData['points']
  let auto: ReturnType<typeof processDayTrack>

  return {
    initialize(data: DayData) {
      base = data
      raw = (base.rawPoints ?? base.points).map(p => ({
        ...p,
        activity: p.recordedActivity ?? p.activity,
        altitude: p.altitude ?? null,
        bearing: p.bearing ?? null,
        activityConfidence: p.activityConfidence ?? 0,
      }))

      prepared = prepareTrack(raw)
      auto = processDayTrack(raw)
    },
    calculate(corrections: ActivityCorrection[]): DayData {
      const segments = applyActivityCorrections(auto, corrections, raw)

      const preview: DayData = {
        ...base,
        corrections,
        points: annotateTrackPoints(prepared.map(p => ({
          ...p,
          activity: p.recordedActivity ?? p.activity,
        })), segments, corrections),
        rawPoints: annotateTrackPoints(raw, segments, corrections),
        segments: segments.map((s, i) => ({
          id: `draft-${i}`,
          sessionId: s.points[0].sessionId,
          activity: s.activity,
          activitySource: s.activitySource,
          confidence: s.confidence,
          startedAt: s.points[0].tsUtc,
          endedAt: s.points.at(-1)!.tsUtc,
          distanceM: s.features.distanceM,
          pointCount: s.points.length,
          simplifiedPoints: s.points,
          geometry: s.points.map(p => [p.lng, p.lat]),
        })),
      }
      preview.preparedRenderSegments = detailedRouteSegments(preview)

      return preview
    },
  }
}
