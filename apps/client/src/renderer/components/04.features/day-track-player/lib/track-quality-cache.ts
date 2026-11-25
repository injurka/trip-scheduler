import type { QualityAnalysis } from '../ui/day-track-quality.vue'

const qualityResultsStore = new Map<string, Record<string, QualityAnalysis>>()

function makeQualityCacheKey(userId: string | undefined, tripId: string | undefined, day: string): string {
  return `${userId ?? 'anon'}:${tripId ?? 'self'}:${day}`
}

export function readQualityResultsCache(userId: string | undefined, tripId: string | undefined, day: string): Record<string, QualityAnalysis> {
  if (!day)
    return {}

  return qualityResultsStore.get(makeQualityCacheKey(userId, tripId, day)) ?? {}
}

export function writeQualityResultsCache(
  userId: string | undefined,
  tripId: string | undefined,
  day: string,
  results: Record<string, QualityAnalysis>,
): void {
  if (!day)
    return

  if (qualityResultsStore.size > 60) {
    const oldest = qualityResultsStore.keys().next().value

    if (oldest)
      qualityResultsStore.delete(oldest)
  }

  qualityResultsStore.set(makeQualityCacheKey(userId, tripId, day), results)
}
