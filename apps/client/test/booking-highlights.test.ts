import type { Booking } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/models/types'
import { describe, expect, it } from 'bun:test'
import { buildRangeHighlightMap } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/lib/booking-highlights'
import { buildTimelineEntries, getTimelineEntryRealTimeRange } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/lib/booking-timeline'

function highlights(bookings: Booking[], now: string) {
  return buildRangeHighlightMap(
    buildTimelineEntries(bookings),
    entry => entry.id,
    getTimelineEntryRealTimeRange,
    Date.parse(now),
  )
}
function train(
  id: string,
  start: string,
  end: string,
  timeZone = '+00:00',
): Booking {
  return {
    id,
    title: id,
    icon: '',
    type: 'train',
    data: { departureDateTime: start, arrivalDateTime: end, departureTimeZone: timeZone, arrivalTimeZone: timeZone },
  }
}

describe('current and next bookings', () => {
  it('highlights all overlapping bookings and picks a future event rather than an expired neighbour', () => {
    const bookings: Booking[] = [
      train('ongoing', '2026-11-08T08:00:00Z', '2026-11-08T18:00:00Z'),
      train('expired', '2026-11-08T09:00:00Z', '2026-11-08T10:00:00Z'),
      train('also-active', '2026-11-08T11:00:00Z', '2026-11-08T13:00:00Z'),
      train('future', '2026-11-08T14:00:00Z', '2026-11-08T15:00:00Z'),
    ]
    expect(highlights(bookings, '2026-11-08T12:00:00Z')).toEqual({ 'ongoing': 'active', 'also-active': 'active', 'future': 'next' })
  })

  it('chooses the earliest actual departure across time zones, not wall-clock order', () => {
    expect(highlights([
      train(
        'later',
        '2026-11-08T09:00:00',
        '2026-11-08T10:00:00',
        '+03:00',
      ),
      train(
        'earlier',
        '2026-11-08T12:00:00',
        '2026-11-08T13:00:00',
        '+08:00',
      ),
    ], '2026-11-08T03:00:00Z')).toEqual({ earlier: 'next' })
  })

  it('updates at the exact start/end and leaves completed trips unhighlighted', () => {
    const booking = train('train', '2026-11-08T10:00:00Z', '2026-11-08T11:00:00Z')
    expect(highlights([booking], '2026-11-08T09:59:59Z')).toEqual({ train: 'next' })
    expect(highlights([booking], '2026-11-08T10:00:00Z')).toEqual({ train: 'active' })
    expect(highlights([booking], '2026-11-08T11:00:00Z')).toEqual({})
  })

  it('includes a multi-day hotel stay through checkout and honours explicit check-in time', () => {
    const booking: Booking = {
      id: 'hotel',
      title: '',
      icon: '',
      type: 'hotel',
      data: { checkInDate: '2026-11-07', checkInTime: '16:30', checkOutDate: '2026-11-09' },
    }
    const entry = buildTimelineEntries([booking])[0]
    const range = getTimelineEntryRealTimeRange(entry)!
    expect(range.start).toBe(new Date('2026-11-07T16:30:00').getTime())
    expect(range.end).toBe(new Date('2026-11-09T12:00:00').getTime())
    expect(buildRangeHighlightMap(
      [entry],
      e => e.id,
      getTimelineEntryRealTimeRange,
      new Date('2026-11-08T10:00:00').getTime(),
    )).toEqual({ hotel: 'active' })
  })

  it('ignores undated and backwards intervals', () => {
    expect(highlights([
      train('bad', '2026-11-08T12:00:00Z', '2026-11-08T11:00:00Z'),
      {
        id: 'empty',
        type: 'other',
        title: '',
        icon: '',
        data: {},
      },
    ], '2026-11-08T10:00:00Z')).toEqual({})
  })

  it('targets the later split flight entry during a long stopover', () => {
    const booking: Booking = {
      id: 'flight',
      type: 'flight',
      title: '',
      icon: '',
      data: {
        segments: [
          { departureDateTime: '2026-11-07T09:00:00Z', arrivalDateTime: '2026-11-07T12:00:00Z' },
          { departureDateTime: '2026-11-08T14:00:00Z', arrivalDateTime: '2026-11-08T16:00:00Z' },
        ],
      },
    }
    expect(highlights([booking], '2026-11-08T13:00:00Z')).toEqual({ 'flight:seg-1-1': 'next' })
    expect(highlights([booking], '2026-11-08T15:00:00Z')).toEqual({ 'flight:seg-1-1': 'active' })
  })
})

describe('booking timestamp precision and malformed input', () => {
  it('does not invent one hour of activity for an event without an end', () => {
    const booking: Booking = {
      id: 'point',
      type: 'attraction',
      icon: '',
      title: '',
      data: { dateTime: '2026-11-08T10:00:00Z' },
    }
    expect(highlights([booking], '2026-11-08T09:59:00Z')).toEqual({ point: 'next' })
    expect(highlights([booking], '2026-11-08T10:01:00Z')).toEqual({})
  })

  it('treats a date-only booking as a local calendar day, including its end boundary', () => {
    const booking: Booking = {
      id: 'day',
      type: 'attraction',
      icon: '',
      title: '',
      data: { dateTime: '2026-11-08' },
    }
    const entry = buildTimelineEntries([booking])[0]
    const range = getTimelineEntryRealTimeRange(entry)!
    expect(range.start).toBe(new Date('2026-11-08T00:00:00').getTime())
    expect(range.end).toBe(new Date('2026-11-09T00:00:00').getTime())
    expect(buildRangeHighlightMap(
      [entry],
      e => e.id,
      getTimelineEntryRealTimeRange,
      range.end - 1,
    )).toEqual({ day: 'active' })
    expect(buildRangeHighlightMap(
      [entry],
      e => e.id,
      getTimelineEntryRealTimeRange,
      range.end,
    )).toEqual({})
  })

  it.each([
    ['2026-02-30T10:00:00', '2026-03-02T11:00:00', '+00:00'],
    ['2026-11-08T24:00:00', '2026-11-09T02:00:00', '+00:00'],
    ['2026-11-08T10:00:00', 'broken', '+00:00'],
    ['2026-11-08T10:00:00', '2026-11-08T11:00:00', '+08:99'],
  ])('rejects invalid start/end/offset: %s, %s, %s', (start, end, offset) => {
    expect(highlights([train(
      'invalid',
      start,
      end,
      offset,
    )], '2026-11-08T09:00:00Z')).toEqual({})
  })

  it('honours explicit timestamp offsets ahead of separate timezone fields', () => {
    expect(highlights([train(
      'explicit',
      '2026-11-08T18:00:00+0800',
      '2026-11-08T19:00:00+0800',
      '-05:00',
    )], '2026-11-08T10:30:00Z')).toEqual({ explicit: 'active' })
  })

  it('preserves hotel timestamps with explicit timezone offsets', () => {
    const booking: Booking = {
      id: 'hotel',
      type: 'hotel',
      icon: '',
      title: '',
      data: { checkInDate: '2026-11-08T15:00:00+08:00', checkOutDate: '2026-11-09T11:00:00+08:00' },
    }
    expect(highlights([booking], '2026-11-08T08:00:00Z')).toEqual({ hotel: 'active' })
    expect(highlights([booking], '2026-11-09T03:00:00Z')).toEqual({})
  })

  it('does not let non-finite generic ranges suppress a valid next booking', () => {
    const items = [{ id: 'bad', start: Number.NaN, end: Number.NaN }, { id: 'next', start: 20, end: 30 }]
    expect(buildRangeHighlightMap(
      items,
      item => item.id,
      item => item,
      10,
    )).toEqual({ next: 'next' })
  })
})
