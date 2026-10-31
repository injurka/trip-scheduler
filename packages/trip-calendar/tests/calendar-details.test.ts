import { describe, expect, it } from 'bun:test'
import { generateTripCalendar } from '../src'
import { calendarPlainText } from '../src/plain-text'

const trip = { id: 'trip', title: 'Trip', startDate: '2026-11-01', endDate: '2026-11-10' }

describe('calendar presentation', () => {
  it('cleans note markup and retains useful links and paragraphs', () => {
    expect(calendarPlainText('**Маршрут*:** До аэропорта.\n\n**Расписание:** Сверить.\n- **Билет**: [Сайт](https://example.com)\n> [!note]\n> `Совет`\n[[Отель|Адрес]]'))
      .toBe('Маршрут: До аэропорта.\n\nРасписание: Сверить.\n• Билет: Сайт (https://example.com)\nСовет\nАдрес')
  })

  it('excludes day summaries by default while preserving timed activities', () => {
    const days = [{ id: 'day', title: 'Day summary', date: '2026-11-04', activities: [{ id: 'act', title: 'Walk', startTime: '10:00', endTime: '11:00' }] }]
    const events = generateTripCalendar({ trip, days }).events()
    expect(events).toHaveLength(1)
    expect(events[0].summary()).toContain('Walk')
    expect(generateTripCalendar({ trip, days }, { includeDaySummaries: true }).events()).toHaveLength(2)
  })

  it('excludes hotel bookings even with check-in times, preserving itinerary activities', () => {
    const events = generateTripCalendar({
      trip,
      bookings: [
        { id: 'hotel', type: 'hotel', title: 'Booking hotel', data: {
          checkInDate: '2026-11-10',
          checkOutDate: '2026-11-11',
          checkInTime: '15:00',
          checkOutTime: '11:00',
        } },
        { id: 'unknown-time', type: 'hotel', title: 'Other hotel', data: {
          checkInDate: '2026-11-10',
          checkOutDate: '2026-11-11',
        } },
      ],
      days: [{ id: 'day', date: '2026-11-11', title: 'Hualien', activities: [
        { id: 'checkin', title: 'Заселение в Together Hotel Hualien', startTime: '12:20', endTime: '12:35' },
      ] }],
    }).events()
    expect(events).toHaveLength(1)
    expect(events[0].id()).toBe('act-checkin')
    expect(events[0].toString()).toContain('DTSTART:20261111T122000\r\n')
    expect(events[0].toString()).toContain('DTEND:20261111T123500\r\n')
    expect(events[0].allDay()).toBe(false)
  })

  it('uses transport endpoint offsets and preserves explicit timestamp offsets', () => {
    const events = generateTripCalendar({ trip, bookings: [{ id: 'train', title: 'Train', type: 'train', data: {
      departureDateTime: '2026-11-03T20:45:00',
      departureTimeZone: '+04:00',
      arrivalDateTime: '2026-11-04T09:56:00+03:00',
      arrivalTimeZone: '+08:00',
    } }] }).events()
    expect((events[0].start() as Date).toISOString()).toBe('2026-11-03T16:45:00.000Z')
    expect((events[0].end() as Date).toISOString()).toBe('2026-11-04T06:56:00.000Z')
  })
})
