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

it('uses local itinerary times instead of adding timezone-shifted booking duplicates', () => {
  const cases = [
    { date: '2026-11-06', title: 'Перелёт CZ3097', start: '12:00', end: '14:15', type: 'flight', data: { segments: [{ departureDateTime: '2026-11-06T12:00:00', arrivalDateTime: '2026-11-06T14:15:00', departureTimeZone: '+08:00', arrivalTimeZone: '+08:00' }] } },
    { date: '2026-11-11', title: 'Поезд 4187', start: '13:25', end: '13:46', type: 'train', data: { departureDateTime: '2026-11-11T13:25:00', arrivalDateTime: '2026-11-11T13:46:00', departureTimeZone: '+08:00', arrivalTimeZone: '+08:00' } },
    { date: '2026-11-13', title: 'Поезд 637', start: '12:29', end: '13:48', type: 'train', data: { departureDateTime: '2026-11-13T12:29:00', arrivalDateTime: '2026-11-13T13:48:00', departureTimeZone: '+08:00', arrivalTimeZone: '+08:00' } },
    { date: '2026-11-17', title: 'Автобус 7322', start: '09:10', end: '11:55', type: 'car', data: { pickupDateTime: '2026-11-17T09:10:00', dropoffDateTime: '2026-11-17T11:55:00', pickupTimeZone: '+08:00', dropoffTimeZone: '+08:00' } },
  ]
  for (const item of cases) {
    const input = { trip, days: [{ id: 'day', date: item.date, title: 'Day', activities: [{ id: 'activity', title: item.title, startTime: item.start, endTime: item.end }] }], bookings: [{ id: 'booking', title: item.title, type: item.type, data: item.data }] }
    const events = generateTripCalendar(input).events()
    expect(events).toHaveLength(1)
    expect(events[0].id()).toBe('act-activity')
    expect(events[0].toString()).toContain(`DTSTART:${item.date.replaceAll('-', '')}T${item.start.replace(':', '')}00\r\n`)
    expect(generateTripCalendar(input, { includeActivities: false }).events()).toHaveLength(1)
  }
})

it('keeps flight segment identity when another segment is covered by an itinerary', () => {
  const events = generateTripCalendar({ trip, days: [{ id: 'day', date: '2026-11-06', title: 'Day', activities: [{ id: 'act', title: 'Flight', startTime: '12:00', endTime: '14:15' }] }], bookings: [{ id: 'flight', title: 'Flight', type: 'flight', data: { segments: [
    { departureDateTime: '2026-11-06T12:00:00+08:00', arrivalDateTime: '2026-11-06T14:15:00+08:00' },
    { departureDateTime: '2026-11-07T00:15:00+08:00', arrivalDateTime: '2026-11-07T02:15:00+08:00' },
  ] } }] }).events()
  expect(events.map(event => event.id())).toEqual(['booking-flight-seg-1', 'act-act'])
})
