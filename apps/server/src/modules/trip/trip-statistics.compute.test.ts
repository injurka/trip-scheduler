import type { TrackPoint } from '@limiteddissolve/track-processing'
import { describe, expect, it } from 'bun:test'
import { summarizeTripTrack } from './trip-statistics.compute'

function route(sessionId = 'one', start = Date.parse('2026-11-11T10:00:00Z')): TrackPoint[] {
  return Array.from({ length: 100 }, (_, i) => ({ clientPointId: `${sessionId}-${i}`, sessionId, tsUtc: start + i * 5000, lat: 0, lng: 30 + i * 7 / 111195, speed: 1.4, accuracy: 3, altitude: null, bearing: null, activity: 'walk', activityConfidence: 90 }))
}

describe('trip tracking statistics', () => {
  it('handles empty tracks without invented achievements', () => {
    expect(summarizeTripTrack([], [])).toEqual({ distanceM: { walk: 0, bike: 0, vehicle: 0, rail: 0, metro: 0, ship: 0, plane: 0, cable_car: 0, moto: 0, unknown: 0 }, movingDurationMs: 0, longestDay: null, trackedDays: 0 })
  })
  it('measures walking and keeps manual changes', () => {
    const points = route()
    const auto = summarizeTripTrack(points, [])
    expect(auto.distanceM.walk).toBeGreaterThan(500)
    expect(auto.longestDay?.date).toBe('2026-11-11')
    const corrected = summarizeTripTrack(points, [{ id: 'manual-change', sessionId: 'one', startedAt: points[0].tsUtc, endedAt: points.at(-1)!.tsUtc, activity: 'vehicle', createdAt: 1 }])
    expect(corrected.distanceM.walk).toBe(0)
    expect(corrected.distanceM.vehicle).toBeCloseTo(auto.distanceM.walk)
  })
  it.each([['metro', 'ship'], ['plane', 'cable_car'], ['moto', 'ship']] as const)('counts %s and %s distances separately', (early, late) => {
    const metro = route('subway')
    const ship = route('ferry', Date.parse('2026-11-11T10:20:00Z'))
    const corrected = summarizeTripTrack([...metro, ...ship], [
      { id: 'metro', sessionId: 'subway', startedAt: metro[0].tsUtc, endedAt: metro.at(-1)!.tsUtc, activity: early, createdAt: 1 },
      { id: 'ship', sessionId: 'ferry', startedAt: ship[0].tsUtc, endedAt: ship.at(-1)!.tsUtc, activity: late, createdAt: 2 },
    ])
    expect(corrected.distanceM[early]).toBeGreaterThan(500)
    expect(corrected.distanceM[late]).toBeGreaterThan(500)
    expect(corrected.distanceM.walk).toBe(0)
  })
  it('does not bridge separate days or recording sessions', () => {
    const first = route()
    const second = route('two', Date.parse('2026-11-12T10:00:00Z')).map(p => ({ ...p, lng: p.lng + 10 }))
    const result = summarizeTripTrack([...second, ...first], [])
    expect(result.trackedDays).toBe(2)
    expect(result.distanceM.walk).toBeCloseTo(summarizeTripTrack(first, []).distanceM.walk * 2)
    expect(result.distanceM.vehicle).toBe(0)
  })
})
