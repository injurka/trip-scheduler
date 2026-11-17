import type { TrackActivityType, TrackPoint } from '../src/index'
import { describe, expect, it } from 'vitest'
import { ActivityState, annotateTrackPoints, applyActivityCorrections, classifySegment, consolidateSegments, deviceReco, processDayTrack, smoothMotorSegments } from '../src/index'

function route(speeds: number[], deviceActivity?: TrackActivityType): TrackPoint[] {
  let lng = 48
  return speeds.map((speed, i) => {
    lng += speed * 5 / 111_195
    return { clientPointId: `point-${i}`, sessionId: 'session', tsUtc: 1_800_000_000_000 + i * 5_000, lat: 0, lng, speed, accuracy: 7, altitude: null, bearing: null, activity: 'walk', activityConfidence: 90, deviceActivity, deviceActivityConfidence: deviceActivity ? 90 : null }
  })
}

describe('bUG-039 classification', () => {
  it('rejects stale walking and cycling hints during sustained 50.4 km/h travel in both directions', () => {
    for (const hint of ['walk', 'bike'] as const) {
      const points = route(Array.from<number>({ length: 120 }).fill(14), hint)
      expect(classifySegment(points, { activity: hint, share: 0.9 }).activity).toBe('vehicle')
      for (const direction of [1, -1]) {
        const directional = points.map(p => ({ ...p, lng: p.lng * direction }))
        const segments = processDayTrack(directional)
        expect(segments.length).toBeGreaterThan(0)
        expect(segments.every(s => s.activity === 'vehicle')).toBe(true)
        expect(annotateTrackPoints(directional, segments).every(p => p.activity === 'vehicle')).toBe(true)
      }
    }
  })

  it('uses time windows consistently at different GPS sampling intervals', () => {
    for (const interval of [1_000, 5_000, 15_000, 45_000, 60_000, 90_000]) {
      const points = route(Array.from<number>({ length: Math.max(8, Math.floor(300_000 / interval)) }).fill(14), 'walk')
        .map((p, i) => ({ ...p, tsUtc: 1_800_000_000_000 + i * interval, lng: 48 + i * 14 * interval / 1000 / 111_195 }))
      const segments = processDayTrack(points)
      expect(segments.length).toBeGreaterThan(0)
      expect(segments.every(s => s.activity === 'vehicle')).toBe(true)
    }
  })

  it('does not turn an isolated speed outlier into a car journey', () => {
    const points = route(Array.from<number>({ length: 120 }).fill(1.4), 'walk')
    points[60].speed = 14
    expect(processDayTrack(points).every(s => s.activity !== 'vehicle')).toBe(true)
  })

  it('uses the Android vehicle hint for slow traffic without inventing evidence from old labels', () => {
    const traffic = route(Array.from<number>({ length: 40 }).fill(3), 'vehicle')
    expect(classifySegment(traffic, deviceReco(traffic)).activity).toBe('vehicle')
    const points = route(Array.from<number>({ length: 40 }).fill(3), 'walk')
    points.forEach((p) => {
      p.deviceActivity = null
    })
    expect(deviceReco(points)).toBe('unknown')
  })

  it('preserves motor travel through slowdowns but allows a confirmed walk', () => {
    const state = new ActivityState()
    const base = 1_800_000_000_000
    expect(state.update('vehicle', base, true)).toBe('unknown')
    expect(state.update('vehicle', base + 15_000, true)).toBe('vehicle')
    expect(state.update('bike', base + 20_000)).toBe('vehicle')
    expect(state.update('bike', base + 200_000)).toBe('vehicle')
    expect(state.update('walk', base + 210_000, false, true)).toBe('vehicle')
    expect(state.update('walk', base + 260_000, false, true)).toBe('walk')
    expect(state.update('vehicle', base + 300_000, true)).toBe('walk')
    expect(state.update('walk', base + 305_000)).toBe('walk')
  })

  it('repairs bounded ambiguous slowdowns while preserving sensor-confirmed changes and session boundaries', () => {
    const points = route(Array.from<number>({ length: 100 }).fill(14))
    const make = (from: number, to: number, activity: TrackActivityType) => ({ ...classifySegment(points.slice(from, to)), activity })
    const segments = [make(0, 30, 'vehicle'), make(29, 55, 'bike'), make(54, 100, 'vehicle')]
    segments[1].confidence = 0.4
    expect(smoothMotorSegments(segments)[1].activity).toBe('vehicle')
    segments[1].points = segments[1].points.map(p => ({ ...p, deviceActivity: 'bike', deviceActivityConfidence: 90 }))
    expect(smoothMotorSegments(segments)[1].activity).toBe('bike')
    segments[1].points = segments[1].points.map(p => ({ ...p, sessionId: 'other', deviceActivity: null }))
    expect(smoothMotorSegments(segments)[1].activity).toBe('bike')
  })
})

describe('interval corrections', () => {
  it('preserves source data and applies the latest overlapping correction after reprocessing', () => {
    const points = route(Array.from<number>({ length: 40 }).fill(14))
    const original = structuredClone(points)
    const t = points[0].tsUtc
    const corrections = [
      { id: 'a', sessionId: 'session', startedAt: t + 20_000, endedAt: t + 80_000, activity: 'bike' as const, createdAt: 1 },
      { id: 'b', sessionId: 'session', startedAt: t + 40_000, endedAt: t + 60_000, activity: 'walk' as const, createdAt: 2 },
    ]
    const process = () => annotateTrackPoints(points, applyActivityCorrections(processDayTrack(points), corrections))
    const fixes = process()
    expect(fixes[6].activity).toBe('bike')
    expect(fixes[10].activity).toBe('walk')
    expect(fixes[10].activitySource).toBe('manual')
    expect(fixes[20].activity).toBe('vehicle')
    expect(process()).toEqual(fixes)
    expect(points).toEqual(original)
    expect(annotateTrackPoints(points, processDayTrack(points))[10].activity).toBe('vehicle')
    expect(applyActivityCorrections(processDayTrack(points), corrections.map(c => ({ ...c, sessionId: 'other' })))).toEqual(processDayTrack(points))
  })
})

describe('pedestrian speed consistency', () => {
  function turningRoute(speed: number) {
    return route(Array.from<number>({ length: 80 }).fill(speed), 'walk').map((p, i) => ({ ...p, lat: i % 2 === 0 ? 0 : 0.00025 }))
  }
  it('does not classify sustained 34 km/h on a winding path as walking despite a strong Android walk hint', () => {
    const points = turningRoute(34.3 / 3.6)
    expect(classifySegment(points, { activity: 'walk', share: 1 }).activity).not.toBe('walk')
    expect(processDayTrack(points).every(s => s.activity !== 'walk')).toBe(true)
  })
  it('does not absorb a geometry-supported fast short segment into adjacent walking', () => {
    const walking = classifySegment(route(Array.from<number>({ length: 30 }).fill(1.4)), 'walk')
    const fast = classifySegment(route(Array.from<number>({ length: 4 }).fill(25 / 3.6)), 'unknown')
    fast.points = fast.points.map(p => ({ ...p, tsUtc: p.tsUtc + 150_000 }))
    expect(fast.features.distanceM).toBeLessThan(120)
    expect(fast.activity).not.toBe('walk')
    expect(consolidateSegments([walking, fast]).some(s => s.activity !== 'walk')).toBe(true)
  })
  it('does not smooth a confirmed brief acceleration into a walking interval', () => {
    const speeds = [...Array.from<number>({ length: 60 }).fill(1.4), ...Array.from<number>({ length: 7 }).fill(34.3 / 3.6), ...Array.from<number>({ length: 60 }).fill(1.4)]
    const points = route(speeds, 'walk')
    const effective = annotateTrackPoints(points, processDayTrack(points))
    expect(effective[63].activity).not.toBe('walk')
  })
  it('recognizes a reliable continuous 3.6 km/h path as walking without a device hint', () => {
    const points = route(Array.from<number>({ length: 100 }).fill(1)).map(p => ({ ...p, deviceActivity: null, deviceActivityConfidence: null }))
    expect(processDayTrack(points).every(s => s.activity === 'walk')).toBe(true)
  })
  it('does not infer walking from a 3.6 km/h sensor reading without real displacement', () => {
    const points = route(Array.from<number>({ length: 100 }).fill(1)).map((p, i) => ({ ...p, lng: 48 + (i % 2) * 0.00001, deviceActivity: null, deviceActivityConfidence: null }))
    expect(processDayTrack(points).every(s => s.activity !== 'walk')).toBe(true)
  })
})

describe('slow walking continuity', () => {
  it('keeps a 2–5 km/h walking stretch continuous when device recognition disappears', () => {
    for (const accuracy of [7, 30]) {
      for (const speed of [0.55, 0.83, 1.11, 1.39]) {
        const points = route(Array.from({ length: 180 }, (_, i) => i < 60 || i >= 120 ? 1.4 : speed), 'walk')
        points.forEach((point) => {
          point.accuracy = accuracy
        })
        for (const point of points.slice(60, 120)) {
          point.deviceActivity = null
          point.deviceActivityConfidence = null
        }
        const segments = processDayTrack(points)
        expect(segments.length).toBeGreaterThan(0)
        expect(segments.every(segment => segment.activity === 'walk')).toBe(true)
      }
    }
  })
  it('recognizes geometry-backed slow walking without an accelerometer hint', () => {
    for (const interval of [1000, 5000, 15000, 45000]) {
      const points = route(Array.from<number>({ length: Math.max(8, Math.floor(300000 / interval)) }).fill(0.55))
        .map((point, i) => ({ ...point, tsUtc: 1800000000000 + i * interval, lng: 48 + i * 0.55 * interval / 1000 / 111195 }))
      const segments = processDayTrack(points)
      expect(segments.length).toBeGreaterThan(0)
      expect(segments.every(segment => segment.activity === 'walk')).toBe(true)
      expect(classifySegment(points).activity).toBe('walk')
    }
  })
  it('does not call a stationary phone walking just because its speed says 5 km/h', () => {
    const points = route(Array.from<number>({ length: 120 }).fill(1.4))
    points.forEach((point, i) => {
      point.lng = 48 + Math.sin(i) * 2 / 111195
    })
    const segments = processDayTrack(points)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.every(segment => segment.activity === 'still')).toBe(true)
  })
  it('does not bridge separate sessions or real GPS gaps with a walking segment', () => {
    const points = route(Array.from<number>({ length: 180 }).fill(0.55))
    for (const point of points.slice(60, 120)) point.tsUtc += 1800000
    for (const point of points.slice(120)) {
      point.tsUtc += 3600000
      point.sessionId = 'second-session'
    }
    const segments = processDayTrack(points)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.every(segment => segment.points.every(point => point.sessionId === segment.points[0].sessionId))).toBe(true)
    expect(segments.every(segment => segment.points.at(-1)!.tsUtc - segment.points[0].tsUtc < 900000)).toBe(true)
  })
})

it('preserves confirmed bicycle and vehicle recognition at walking speed', () => {
  for (const activity of ['bike', 'vehicle'] as const) {
    const points = route(Array.from<number>({ length: 120 }).fill(0.55), activity)
    expect(classifySegment(points, deviceReco(points)).activity).toBe(activity)
    expect(processDayTrack(points).every(segment => segment.activity === activity)).toBe(true)
  }
})

it('retains a real stationary pause between two walking stretches', () => {
  const points = route(Array.from({ length: 180 }, (_, i) => i < 60 || i >= 120 ? 1.4 : 0))
  const segments = processDayTrack(points)
  expect(segments.some(segment => segment.activity === 'walk')).toBe(true)
  expect(segments.some(segment => segment.activity === 'still')).toBe(true)
})
