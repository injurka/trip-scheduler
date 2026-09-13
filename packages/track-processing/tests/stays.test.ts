import type { TrackPoint } from '../src/index'
import { describe, expect, it } from 'vitest'
import { prepareTrack, processDayTrack, splitTrackIntoLegs } from '../src/index'

function fix(i: number, x: number, y = 0, activity: 'still' | 'walk' | 'unknown' = 'unknown'): TrackPoint {
  return {
    clientPointId: `p-${i}`,
    tsUtc: 1_700_000_000_000 + i * 3000,
    sessionId: 'a',
    lat: 55 + y / 111_320,
    lng: 37 + x / (111_320 * Math.cos(55 * Math.PI / 180)),
    accuracy: 20,
    altitude: null,
    bearing: null,
    speed: null,
    activity,
    activityConfidence: 0,
    deviceActivity: activity,
    deviceActivityConfidence: 90,
  }
}

describe('dwell processing', () => {
  it('keeps a twenty-minute cafe visit stationary without mutating raw fixes', () => {
    const raw = Array.from({ length: 401 }, (_, i) => fix(i, Math.sin(i * 2.3) * 18, Math.cos(i * 1.7) * 15, 'still'))
    const copy = structuredClone(raw)
    const points = prepareTrack(raw)
    expect(points.every(p => p.stop && p.speed === 0)).toBe(true)
    expect(points[0].stop!.endedAt - points[0].stop!.startedAt).toBe(1_200_000)
    expect(new Set(points.map(p => `${p.lat},${p.lng}`)).size).toBe(1)
    expect(processDayTrack(raw).reduce((sum, s) => sum + s.features.distanceM, 0)).toBe(0)
    expect(raw).toEqual(copy)
  })

  it('releases the anchor and retains departure fixes after walking resumes', () => {
    const raw = Array.from({ length: 101 }, (_, i) => fix(i, Math.sin(i) * 12, 0, 'still'))
    raw.push(...Array.from({ length: 60 }, (_, i) => fix(101 + i, (i + 1) * 3, 0, 'walk')))
    const points = prepareTrack(raw)
    expect(points[100].stop).toBeDefined()
    expect(points[101].stop).toBeUndefined()
    expect(points.at(-1)?.lng).toBeGreaterThan(points[100].lng)
    const segments = processDayTrack(raw)
    expect(segments.filter(s => s.activity === 'still').every(s => s.features.distanceM === 0)).toBe(true)
    expect(segments.reduce((s, p) => s + p.features.distanceM, 0)).toBeGreaterThan(120)
  })

  it('does not swallow a slow walk or a walking loop', () => {
    const slow = Array.from({ length: 150 }, (_, i) => fix(i, i * 0.9))
    expect(prepareTrack(slow).some(p => p.stop)).toBe(false)
    const loop = Array.from({ length: 150 }, (_, i) => fix(i, Math.sin(i / 10) * 15, Math.cos(i / 10) * 15, 'walk'))
    expect(prepareTrack(loop).some(p => p.stop)).toBe(false)
  })

  it('does not merge visits across sessions or missing observations', () => {
    const raw = Array.from({ length: 30 }, (_, i) => fix(i, 0, 0, 'still'))
    raw.push(...Array.from({ length: 30 }, (_, i) => ({ ...fix(i + 31, 0, 0, 'still'), sessionId: 'b' })))
    expect(prepareTrack(raw).some(p => p.stop)).toBe(false)
    expect(splitTrackIntoLegs(raw)).toHaveLength(2)
    const gap = raw.map((p, i) => ({ ...p, sessionId: 'a', tsUtc: p.tsUtc + (i >= 30 ? 3_600_000 : 0) }))
    expect(prepareTrack(gap).some(p => p.stop)).toBe(false)
  })

  it('tolerates an isolated excursion while staying anchored', () => {
    const raw = Array.from({ length: 140 }, (_, i) => fix(i, i === 100 ? 48 : Math.sin(i) * 8, 0, 'still'))
    expect(prepareTrack(raw).every(p => p.stop)).toBe(true)
  })
})
