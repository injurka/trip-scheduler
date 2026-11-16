import { describe, expect, it } from 'bun:test'
import { getLocalDate, getTimeFromTimestamp } from '../src/renderer/shared/lib/date-time'

describe('processing card capture time', () => {
  it.each([
    ['2026-11-15T09:48:00.000Z', 480, '2026-11-15', 17, 48],
    ['2026-11-15T10:02:00.000Z', 480, '2026-11-15', 18, 2],
    ['2026-11-15T20:30:00.000Z', 480, '2026-11-16', 4, 30],
    ['2026-11-15T02:30:00.000Z', -300, '2026-11-14', 21, 30],
    ['2026-11-15T10:02:00.000Z', 0, '2026-11-15', 10, 2],
  ])('uses the photo offset for %s (%s minutes)', (
    takenAt,
    offset,
    day,
    hour,
    minute,
  ) => {
    const local = getLocalDate(takenAt, offset)
    expect(local.toISOString().split('T')[0]).toBe(day)
    const time = getTimeFromTimestamp(local.toISOString())
    expect(time.hour).toBe(hour)
    expect(time.minute).toBe(minute)
  })
})
