import { describe, expect, it } from 'vitest'
import { calendarDay, calendarDayBounds, isTimeZone } from '../src/calendar'
import { recordingQuality } from '../src/quality'

describe('calendar days', () => {
  it('puts Taiwan 07:30 in November 17, including local midnight and excluding the next midnight', () => {
    const bounds = calendarDayBounds('2026-11-17', 'Asia/Taipei')
    expect(bounds.from.toISOString()).toBe('2026-11-16T16:00:00.000Z')
    expect(bounds.to.toISOString()).toBe('2026-11-17T16:00:00.000Z')
    expect(calendarDay(Date.parse('2026-11-16T23:30Z'), 'Asia/Taipei')).toBe('2026-11-17')
  })
  it('uses calendar arithmetic on 23 and 25 hour days', () => {
    const spring = calendarDayBounds('2026-03-08', 'America/New_York')
    const autumn = calendarDayBounds('2026-11-01', 'America/New_York')
    expect(spring.to.getTime() - spring.from.getTime()).toBe(23 * 3600000)
    expect(autumn.to.getTime() - autumn.from.getTime()).toBe(25 * 3600000)
    expect(isTimeZone('Asia/Taipei')).toBe(true)
    expect(isTimeZone('Not/AZone')).toBe(false)
    expect(() => calendarDayBounds('2026-02-30', 'UTC')).toThrow()
  })
})
it('reports gaps from raw fixes without counting restarts or inventing missing accuracy', () => {
  const points = [
    { sessionId: 'a', tsUtc: 0, accuracy: 5 },
    { sessionId: 'a', tsUtc: 3000, accuracy: 50 },
    { sessionId: 'a', tsUtc: 6000, accuracy: 70 },
    { sessionId: 'a', tsUtc: 66000, accuracy: 50 },
    { sessionId: 'a', tsUtc: 69000, accuracy: null },
    { sessionId: 'b', tsUtc: 9999999, accuracy: 5 },
  ]
  expect(recordingQuality([...points].reverse(), [{ id: '1' }, { id: '1' }, { id: '2' }])).toMatchObject({ gapCount: 1, gapDurationMs: 60000, inaccurateSections: 2, inaccuratePoints: 3, unknownAccuracyPoints: 1, manualCorrections: 2 })
  expect(recordingQuality([]).gapCount).toBe(0)
})
it('reports measured durations and does not confuse economy sampling with missing GPS', () => {
  const quality = recordingQuality([
    { sessionId: 'A', tsUtc: 1000, accuracy: 50 },
    { sessionId: 'A', tsUtc: 4000, accuracy: 50 },
    { sessionId: 'A', tsUtc: 7000, accuracy: 5 },
    { sessionId: 'A', tsUtc: 67000, accuracy: 5 },
  ])
  expect(quality.inaccurateDurationMs).toBe(6000)
  expect(quality.durationMs).toBe(66000)
  expect(quality.issues[0]).toMatchObject({ kind: 'accuracy', startedAt: 1000, endedAt: 7000 })
  expect(quality.gapPercent).toBeCloseTo(60000 / 66000 * 100)
  expect(recordingQuality([{ sessionId: 'A', tsUtc: 1000, samplingIntervalMs: 30000 }, { sessionId: 'A', tsUtc: 35000, samplingIntervalMs: 30000 }]).gapCount).toBe(0)
})
