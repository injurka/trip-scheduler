import type { ActivityCorrection, TrackPoint } from '@limiteddissolve/track-processing'
import type { DayData } from '../models/types'
import { annotateTrackPoints, applyActivityCorrections, processDayTrack } from '@limiteddissolve/track-processing'
import { computed, ref } from 'vue'

export type CorrectionChoice = Omit<ActivityCorrection, 'id' | 'createdAt'> & { point?: boolean }

export function useTrackCorrectionDrafts() {
  const additions = ref<Array<ActivityCorrection & { point?: boolean }>>([])
  const removals = ref<string[]>([])
  const attempted = new Set<string>()
  const count = computed(() => additions.value.length + removals.value.length)
  const automatic = new WeakMap<DayData, ReturnType<typeof processDayTrack>>()
  function stage(choice: CorrectionChoice, data: DayData | null) {
    const replaced = additions.value.filter(c => c.sessionId === choice.sessionId && c.startedAt === choice.startedAt && c.endedAt === choice.endedAt)
    const cleanup = replaced.filter(c => attempted.has(c.id) && !removals.value.includes(c.id)).map(c => c.id)
    const prior = additions.value.filter(c => !(c.sessionId === choice.sessionId && c.startedAt === choice.startedAt && c.endedAt === choice.endedAt))

    if (prior.length + removals.value.length + cleanup.length >= 200)
      throw new Error('Примените текущий пакет: максимум 200 изменений.')

    const time = Math.max(Date.now(), ...[...(data?.corrections ?? []), ...additions.value].map(c => c.createdAt + 1))
    removals.value.push(...cleanup)
    additions.value = [...prior, { ...choice, id: crypto.randomUUID(), createdAt: time }]
  }
  function remove(id: string) {
    if (additions.value.some(c => c.id === id)) {
      additions.value = additions.value.filter(c => c.id !== id)

      if (attempted.has(id) && !removals.value.includes(id))
        removals.value.push(id)
    }
    else if (!removals.value.includes(id)) {
      if (count.value >= 200)
        throw new Error('Примените текущий пакет: максимум 200 изменений.')

      removals.value.push(id)
    }
  }
  function clear() {
    additions.value = []
    removals.value = []
    attempted.clear()
  }
  function preview(base: DayData): DayData {
    if (!count.value)
      return base

    const raw: TrackPoint[] = (base.rawPoints ?? base.points).map(p => ({
      ...p,
      activity: p.recordedActivity ?? p.activity,
      altitude: p.altitude ?? null,
      bearing: p.bearing ?? null,
      activityConfidence: p.activityConfidence ?? 0,
    }))
    let auto = automatic.get(base)

    if (!auto) {
      auto = processDayTrack(raw)
      automatic.set(base, auto)
    }

    const corrections = [...(base.corrections ?? []).filter(c => !removals.value.includes(c.id)), ...additions.value]
    const segments = applyActivityCorrections(auto, corrections, raw)

    return {
      ...base,
      corrections,
      points: annotateTrackPoints(base.points.map(p => ({ ...p, activity: p.recordedActivity ?? p.activity })), segments, corrections),
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
  }

  return {
    additions,
    removals,
    count,
    stage,
    remove,
    clear,
    preview,
    markSubmitted: () => additions.value.forEach(c => attempted.add(c.id)),
  }
}
