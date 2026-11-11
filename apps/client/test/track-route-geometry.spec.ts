import type { DayData, DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { describe, expect, it } from 'vitest'
import { detailedRouteSegments, roundedRouteCoordinates } from '../src/renderer/components/04.features/day-track-player/lib/track-route-geometry'
import { clipTrackLeg } from '../src/renderer/components/04.features/day-track-player/lib/track-time-window'

function point(i: number, x: number, y = 0): DayPoint {
  return {
    clientPointId: `${i}`,
    sessionId: 's',
    tsUtc: i * 5000,
    lat: y / 111195,
    lng: x / 111195,
    speed: 1,
    accuracy: 5,
    activity: 'walk',
  }
}
function fixture(): DayData {
  return {
    points: [point(0, 0), point(1, 5), point(2, 10, 5), point(3, 15), point(4, 20)],
    segments: [{
      id: 'a',
      sessionId: 's',
      activity: 'walk',
      activitySource: 'manual',
      startedAt: 0,
      endedAt: 20000,
      geometry: [[0, 0], [20 / 111195, 0]],
      simplifiedPoints: [point(0, 0), point(4, 20)],
      confidence: 1,
      distanceM: 20,
      pointCount: 5,
    }],
  }
}

describe('detailed route geometry', () => {
  it('preserves bends omitted from simplified server geometry and manual activity colors', () => {
    const data = fixture()
    const copy = structuredClone(data)
    const [segment] = detailedRouteSegments(data)
    expect(segment.points).toHaveLength(5)
    expect(segment.points[2].lat).toBeGreaterThan(0)
    expect(segment.activitySource).toBe('manual')
    expect(data).toEqual(copy)
  })
  it('never connects a recording gap', () => {
    const data = fixture()
    data.points[3].tsUtc = 3600000
    data.points[4].tsUtc = 3605000
    data.segments[0].endedAt = 3605000
    expect(detailedRouteSegments(data).map(s => s.points.length)).toEqual([3, 2])
  })
  it('keeps simultaneous sessions separate', () => {
    const data = fixture()
    data.points = data.points.flatMap(p => [p, { ...p, sessionId: 'other', lng: p.lng + 1 }])
    expect(detailedRouteSegments(data)[0].points).toEqual(fixture().points)
  })
  it('preserves clipped playback endpoints and empty windows', () => {
    const [segment] = detailedRouteSegments(fixture())
    const clipped = clipTrackLeg(segment.points, 6000, 12000)
    const rounded = roundedRouteCoordinates(clipped)
    expect(rounded[0]).toEqual([clipped[0].lng, clipped[0].lat])
    expect(rounded.at(-1)).toEqual([clipped.at(-1)!.lng, clipped.at(-1)!.lat])
    expect(roundedRouteCoordinates([])).toEqual([])
  })
  it('rounds a right-angle corner within one metre of the measured vertex without overshoot', () => {
    const points = [point(0, 0), point(1, 10), point(2, 10, 10)]
    const rounded = roundedRouteCoordinates(points)
    expect(rounded.length).toBeGreaterThan(3)
    expect(rounded[0]).toEqual([0, 0])
    expect(rounded.at(-1)).toEqual([points[2].lng, points[2].lat])

    for (const [lng, lat] of rounded.slice(1, -1)) {
      expect(Math.hypot(lng * 111195 - 10, lat * 111195)).toBeLessThanOrEqual(1.01)
      expect(lng).toBeLessThanOrEqual(points[1].lng)
      expect(lat).toBeGreaterThanOrEqual(0)
    }
  })
  it('leaves straight paths, duplicates, hairpins and sparse long edges exact', () => {
    for (const points of [
      [point(0, 0), point(1, 10), point(2, 20)],
      [point(0, 0), point(1, 0), point(2, 10)],
      [point(0, 0), point(1, 10), point(2, 0)],
      [point(0, 0), point(1, 100), point(2, 100, 100)],
    ])
      expect(roundedRouteCoordinates(points)).toEqual(points.map(p => [p.lng, p.lat]))
  })
})
