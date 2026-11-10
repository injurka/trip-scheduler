import { describe, expect, it } from 'vitest'
import { clipTrackLeg } from '../src/renderer/components/04.features/day-track-player/lib/track-time-window'
import { splitTrackIntoLegs } from '../src/renderer/shared/services/tracking/track-processing'

const points = [0, 10, 20, 30].map(tsUtc => ({ tsUtc, lat: tsUtc, lng: tsUtc * 2, sessionId: 'a' }))

describe('gPS playback time window', () => {
  it('interpolates both edges and supports rewinding without mutating the recording', () => {
    const original = structuredClone(points)
    expect(clipTrackLeg(points, 5, 15).map(p => [p.tsUtc, p.lat, p.lng])).toEqual([[5, 5, 10], [10, 10, 20], [15, 15, 30]])
    expect(clipTrackLeg(points, Number.NEGATIVE_INFINITY, 25).map(p => p.tsUtc)).toEqual([0, 10, 20, 25])
    expect(clipTrackLeg(points, Number.NEGATIVE_INFINITY, 5).map(p => p.tsUtc)).toEqual([0, 5])
    expect(points).toEqual(original)
  })

  it('handles exact boundaries, empty windows and the end of the recording', () => {
    expect(clipTrackLeg(points, 10, 20).map(p => p.tsUtc)).toEqual([10, 20])
    expect(clipTrackLeg(points, 30, 40).map(p => p.tsUtc)).toEqual([30])
    expect(clipTrackLeg(points, 10, 10).map(p => p.tsUtc)).toEqual([10])
    expect(clipTrackLeg(points, 40, 50)).toEqual([])
    expect(clipTrackLeg(points, -20, -10)).toEqual([])
    expect(clipTrackLeg([], 0, 10)).toEqual([])
  })

  it('keeps signal gaps and different recording sessions disconnected', () => {
    const recording = [
      { tsUtc: 0, lat: 54, lng: 48, sessionId: 'a' },
      { tsUtc: 10_000, lat: 54, lng: 48.001, sessionId: 'a' },
      { tsUtc: 2_000_000, lat: 54, lng: 48.002, sessionId: 'a' },
      { tsUtc: 2_010_000, lat: 54, lng: 48.003, sessionId: 'b' },
    ]
    const legs = splitTrackIntoLegs(recording)
    expect(legs).toHaveLength(3)
    expect(legs.flatMap(leg => clipTrackLeg(leg.points, 20_000, 1_000_000))).toEqual([])
  })
})
