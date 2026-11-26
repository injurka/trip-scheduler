import type { TrackPoint } from '@limiteddissolve/track-processing'
import { describe, expect, it } from 'bun:test'
import { summarizeTripTrack } from './trip-statistics.compute'

function route(sessionId = 'one', start = Date.parse('2026-11-11T10:00:00Z')): TrackPoint[] {
  return Array.from({ length: 100 }, (_, i) => ({ clientPointId: `${sessionId}-${i}`, sessionId, tsUtc: start + i * 5000, lat: 0, lng: 30 + i * 7 / 111195, speed: 1.4, accuracy: 3, altitude: null, bearing: null, activity: 'walk', activityConfidence: 90 }))
}

describe('trip tracking statistics', () => {
  it('handles empty tracks without invented achievements', () => {
    expect(summarizeTripTrack([], [])).toEqual({ distanceM: { walk: 0, bike: 0, vehicle: 0, rail: 0, metro: 0, ship: 0, plane: 0, cable_car: 0, moto: 0, bus: 0, unknown: 0 }, speedByActivity: {}, movingDurationMs: 0, longestDay: null, trackedDays: 0 })
  })
  it('measures walking and keeps manual changes', () => {
    const points = route()
    const auto = summarizeTripTrack(points, [])
    expect(auto.distanceM.walk).toBeGreaterThan(500)
    expect(auto.longestDay?.date).toBe('2026-11-11')
    expect(auto.speedByActivity.walk?.medianKmh).toBeCloseTo(5.04)
    const corrected = summarizeTripTrack(points, [{ id: 'manual-change', sessionId: 'one', startedAt: points[0].tsUtc, endedAt: points.at(-1)!.tsUtc, activity: 'vehicle', createdAt: 1 }])
    expect(corrected.distanceM.walk).toBe(0)
    expect(corrected.distanceM.vehicle).toBeCloseTo(auto.distanceM.walk)
    expect(corrected.speedByActivity.walk).toBeUndefined()
    expect(corrected.speedByActivity.vehicle).toEqual(auto.speedByActivity.walk)
  })
  it.each([['metro', 'ship'], ['plane', 'cable_car'], ['moto', 'ship'], ['bus', 'metro']] as const)('counts %s and %s distances separately', (early, late) => {
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

  it('weights speed percentiles by time instead of the number of fixes', () => {
    const start = Date.parse('2026-11-11T10:00:00Z')
    const runs = [
      { seconds: 30, step: 1, speed: 10 },
      { seconds: 80, step: 10, speed: 20 },
      { seconds: 45, step: 5, speed: 30 },
    ].map(({ seconds, step, speed }, index) => {
      const offset = start + index * 600_000
      return route(String(index), offset).slice(0, seconds / step + 1).map((point, i) => ({
        ...point,
        tsUtc: offset + i * step * 1000,
        lng: 30 + i * step * speed / 111195,
        speed,
      }))
    })
    const corrections = runs.map(run => ({
      id: run[0].sessionId,
      sessionId: run[0].sessionId,
      startedAt: run[0].tsUtc,
      endedAt: run.at(-1)!.tsUtc,
      activity: 'rail' as const,
      createdAt: 1,
    }))
    const speed = summarizeTripTrack(runs.flat(), corrections).speedByActivity.rail
    expect(speed?.p25Kmh).toBeCloseTo(72, 0)
    expect(speed?.medianKmh).toBeCloseTo(72, 0)
    expect(speed?.p75Kmh).toBeCloseTo(108, 0)
  })

  it('uses the recording cadence and omits speed when fixes are too sparse, inaccurate, or few', () => {
    const start = Date.parse('2026-11-11T10:00:00Z')
    const points = route().slice(0, 12).map((point, i) => ({
      ...point,
      tsUtc: start + i * 60_000,
      lng: 30 + i * 90 / 111195,
    }))
    const correction = { id: 'metro', sessionId: 'one', startedAt: start, endedAt: points.at(-1)!.tsUtc, activity: 'metro' as const, createdAt: 1 }
    expect(summarizeTripTrack(points, [correction]).speedByActivity).toEqual({})
    const background = points.map(point => ({ ...point, samplingIntervalMs: 30_000 }))
    expect(summarizeTripTrack(background, [correction]).speedByActivity.metro?.medianKmh).toBeCloseTo(5.4)
    expect(summarizeTripTrack(background.map(point => ({ ...point, accuracy: 40 })), [correction]).speedByActivity).toEqual({})
    expect(summarizeTripTrack(route().slice(0, 5), [correction]).speedByActivity).toEqual({})
  })

  it('does not infer subway speed from a stop manually relabelled as metro', () => {
    const points = route().map(point => ({ ...point, lng: 30, speed: 0, activity: 'still' as const }))
    const correction = { id: 'metro', sessionId: 'one', startedAt: points[0].tsUtc, endedAt: points.at(-1)!.tsUtc, activity: 'metro' as const, createdAt: 1 }
    expect(summarizeTripTrack(points, [correction]).speedByActivity).toEqual({})
  })
})
