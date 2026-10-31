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

  it('creates hotel milestones instead of blocking the whole stay', () => {
    const events = generateTripCalendar({ trip, bookings: [{ id: 'hotel', type: 'hotel', title: 'Hotel', data: {
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
      checkInTime: '15:00',
      checkOutTime: '11:00',
    } }] }).events()
    expect(events).toHaveLength(2)
    expect(events[0].id()).toBe('booking-hotel')
    expect(events[0].summary()).toBe('🏨 Заселение: Hotel')
    expect(events[1].summary()).toBe('🏨 Выезд: Hotel')
    for (const event of events) {
      const ics = event.toString()
      expect(ics).toContain(`DTSTART:${event === events[0] ? '20261101T150000' : '20261105T110000'}\r\n`)
      expect((event.end() as Date).getTime() - (event.start() as Date).getTime()).toBe(30 * 60 * 1000)
    }
  })

  it('does not invent hotel times or alarms when only dates are known', () => {
    const events = generateTripCalendar({ trip, bookings: [{ id: 'hotel', type: 'hotel', title: 'Hotel', data: {
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
    } }] }).events()
    expect(events).toHaveLength(2)
    for (const event of events) {
      expect(event.allDay()).toBe(true)
      expect(event.alarms()).toHaveLength(0)
      expect(event.description()?.plain).toContain('Время не указано')
    }
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
