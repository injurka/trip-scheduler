import { describe, expect, it } from 'vitest'
import { applyTrackGeometryCorrections, inspectTrackGeometry } from '../src'

function point(second: number, meters: number, accuracy: number, still = false) {
  return {
    sessionId: 'session-1',
    tsUtc: second * 1000,
    lat: 0,
    lng: meters / 111_195,
    accuracy,
    speed: still ? 0 : null,
    deviceActivity: still ? 'still' as const : null,
    deviceActivityConfidence: still ? 90 : null,
  }
}

describe('geometry corrections', () => {
  it('excludes an isolated excursion only from the processed route', () => {
    const raw = [point(5, 0, 8), point(10, 140, 50), point(15, 4, 8)]
    const action = inspectTrackGeometry(raw, 10_000, 15_000)
    expect(action?.action).toBe('exclude-spike')
    const effective = applyTrackGeometryCorrections(raw, [{
      geometryAction: 'exclude-spike',
      sessionId: 'session-1',
      startedAt: 10_000,
      endedAt: 15_000,
    }])
    expect(effective).toEqual([raw[0], raw[2]])
    expect(raw).toHaveLength(3)
    expect(raw[1].lng).toBeGreaterThan(0.001)
  })

  it('anchors noisy stop fixes while preserving accurate fixes and their timestamps', () => {
    const raw = [point(5, 0, 6, true), point(10, 80, 55, true), point(15, 5, 9, true), point(20, 90, 60, true), point(25, 3, 8, true)]
    expect(inspectTrackGeometry(raw, 10_000, 25_000)?.action).toBe('collapse-drift')
    const effective = applyTrackGeometryCorrections(raw, [{
      geometryAction: 'collapse-drift',
      sessionId: 'session-1',
      startedAt: 10_000,
      endedAt: 25_000,
    }])
    expect(effective.map(p => p.tsUtc)).toEqual(raw.map(p => p.tsUtc))
    expect(effective.map(p => p.lng)).toEqual([0, 0, raw[2].lng, 0, raw[4].lng])
    expect(raw[3].lng).toBeGreaterThan(0)
  })

  it('leaves missing data and plausible movement alone', () => {
    const raw = [point(5, 0, 8), point(10, 130, 50), point(50, 3, 8)]
    expect(inspectTrackGeometry(raw, 10_000, 10_000)).toBeNull()
    expect(inspectTrackGeometry([raw[0], raw[1], point(15, 200, 8)], 10_000, 10_000)).toBeNull()
    expect(applyTrackGeometryCorrections(raw, [{
      geometryAction: 'exclude-spike',
      sessionId: 'other-session',
      startedAt: 10_000,
      endedAt: 10_000,
    }])).toBe(raw)
  })
})
