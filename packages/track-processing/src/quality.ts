export interface TrackQualityPoint {
  tsUtc: number
  sessionId: string
  accuracy?: number | null
}

/** Computed from original fixes, before stop collapse or route simplification. */
export function recordingQuality(points: readonly TrackQualityPoint[], corrections: readonly { id: string }[] = []) {
  const bySession = new Map<string, TrackQualityPoint[]>()
  for (const point of points) {
    const group = bySession.get(point.sessionId) ?? []
    group.push(point)
    bySession.set(point.sessionId, group)
  }
  let gapCount = 0
  let gapDurationMs = 0
  let inaccurateSections = 0
  let inaccuratePoints = 0
  let unknownAccuracyPoints = 0
  for (const group of bySession.values()) {
    const sorted = [...group].sort((a, b) => a.tsUtc - b.tsUtc)
    let previous: TrackQualityPoint | undefined
    let inInaccurateSection = false
    for (const point of sorted) {
      const gap = previous ? point.tsUtc - previous.tsUtc : 0
      if (gap > 30_000) {
        gapCount++
        gapDurationMs += gap
        inInaccurateSection = false
      }
      if (point.accuracy == null)
        unknownAccuracyPoints++
      const inaccurate = point.accuracy != null && point.accuracy > 35
      if (inaccurate) {
        inaccuratePoints++
        if (!inInaccurateSection)
          inaccurateSections++
      }
      inInaccurateSection = inaccurate
      previous = point
    }
  }
  return { gapCount, gapDurationMs, inaccurateSections, inaccuratePoints, unknownAccuracyPoints, manualCorrections: new Set(corrections.map(c => c.id)).size }
}
