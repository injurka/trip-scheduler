import { describe, expect, it } from 'vitest'
import { annotateTrackPoints, applyActivityCorrections, processDayTrack } from '../src/index'

const points = [0, 10000, 20000].map(tsUtc => ({ clientPointId: String(tsUtc), altitude: null, bearing: null, activityConfidence: 0, sessionId: 's', tsUtc, lat: 25, lng: 121 + tsUtc / 1e8, accuracy: 5, speed: 1, activity: 'walk' as const }))
const correction = (id: string, start: number, end: number, activity: 'bike' | 'vehicle', createdAt: number) => ({ id, sessionId: 's', startedAt: start, endedAt: end, activity, createdAt })
describe('point corrections and overlapping history', () => {
  for (const index of [0, 1, 2]) {
    it(`corrects fix ${index} without changing other fixes or measured distance`, () => {
      const original = processDayTrack(points)
      const corrections = [correction('p', points[index].tsUtc, points[index].tsUtc, 'vehicle', 1)]
      const segments = applyActivityCorrections(original, corrections)
      const annotated = annotateTrackPoints(points, segments, corrections)
      expect(annotated[index].activity).toBe('vehicle')
      expect(annotated[index].activitySource).toBe('manual')
      expect(annotated.filter((_, i) => i !== index).map(p => p.activity)).toEqual(annotateTrackPoints(points, original).filter((_, i) => i !== index).map(p => p.activity))
      expect(segments.reduce((s, p) => s + p.features.distanceM, 0)).toBeCloseTo(original.reduce((s, p) => s + p.features.distanceM, 0))
      expect(points[index].activity).toBe('walk')
    })
  }
  it('supports a session containing only one fix', () => {
    const corrections = [correction('p', 0, 0, 'vehicle', 1)]
    const result = applyActivityCorrections(processDayTrack([points[0]]), corrections, [points[0]])
    expect(annotateTrackPoints([points[0]], result, corrections)[0].activity).toBe('vehicle')
    expect(result[0]?.activity).toBe('vehicle')
  })
  it('uses newest corrections on overlaps and restores previous labels when undone', () => {
    const old = correction('a', 0, 20000, 'bike', 1)
    const latest = correction('b', 10000, 20000, 'vehicle', 2)
    const original = processDayTrack(points)
    expect(annotateTrackPoints(points, applyActivityCorrections(original, [latest, old]), [latest, old]).map(p => p.activity)).toEqual(['bike', 'vehicle', 'vehicle'])
    expect(annotateTrackPoints(points, applyActivityCorrections(original, [old]), [old]).map(p => p.activity)).toEqual(['bike', 'bike', 'bike'])
  })
})
