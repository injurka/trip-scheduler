import { describe, expect, it } from 'bun:test'
import { generateTripCalendar, generateTripCalendarIcs } from '../src'

describe('tripCalendarGenerator', () => {
  it('escapes calendar metadata so multiline text cannot become ICS properties', () => {
    const ics = generateTripCalendarIcs({
      trip: {
        id: 'metadata',
        title: 'Trip, title; \\ path\r\nSecond line',
        description: 'Intro\n\n0. Phase: travel\r\nEND:VCALENDAR\rLast line',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
      },
    }).replace(/\r\n[ \t]/g, '')

    expect(ics).toContain('X-WR-CALNAME:Trip\\, title\\; \\\\ path\\nSecond line\r\n')
    expect(ics).toContain('X-WR-CALDESC:Intro\\n\\n0. Phase: travel\\nEND:VCALENDAR\\nLast line\r\n')
    expect(ics.match(/^END:VCALENDAR$/gm)).toHaveLength(1)
  })

  const sampleTrip = {
    id: 'trip-123',
    title: 'Поездка в Токио',
    description: 'Весеннее путешествие по Японии',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    shareSlug: 'tokyo-spring-2026',
    url: 'https://trip-scheduler.ru/trip/tokyo-spring-2026',
  }

  const sampleDays = [
    {
      id: 'day-1',
      date: '2026-05-01',
      title: 'Прибытие и заселение',
      description: 'Прилет в аэропорт Нарита, переезд на экспрессе в Синдзюку.',
      activities: [
        {
          id: 'act-1',
          startTime: '14:00',
          endTime: '15:30',
          title: 'Обед в рамэнной',
          tag: 'food',
          sections: [
            {
              type: 'description',
              text: 'Знаменитый ичиран рамэн',
            },
            {
              type: 'geolocation',
              address: 'Shinjuku, Tokyo',
              points: [{ lat: 35.6938, lon: 139.7034, address: 'Shinjuku, Tokyo' }],
            },
          ],
        },
      ],
    },
  ]

  const sampleBookings = [
    {
      id: 'b-flight-1',
      title: 'Авиабилет Москва - Токио',
      type: 'flight',
      data: {
        bookingReference: 'XYZ789',
        segments: [
          {
            flightNumber: 'SU-260',
            airline: 'Аэрофлот',
            departureCity: 'Москва',
            arrivalCity: 'Токио',
            departureAirport: 'SVO',
            arrivalAirport: 'NRT',
            departureDateTime: '2026-05-01T08:00:00Z',
            arrivalDateTime: '2026-05-01T18:00:00Z',
            seat: '12A',
          },
        ],
      },
    },
    {
      id: 'b-hotel-1',
      title: 'Отель Park Hyatt',
      type: 'hotel',
      data: {
        hotelName: 'Park Hyatt Tokyo',
        address: 'Shinjuku, Tokyo',
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-05',
        checkInTime: '15:00',
        confirmationNumber: 'HOTEL-999',
      },
    },
  ]

  it('generates a valid iCalendar string with days, activities, and bookings', () => {
    const ics = generateTripCalendarIcs({
      trip: sampleTrip,
      days: sampleDays,
      bookings: sampleBookings,
    }, { includeDaySummaries: true })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('Поездка в Токио')

    // Flight segment
    expect(ics).toContain('SU-260')
    expect(ics).toContain('XYZ789')
    expect(ics).toContain('Москва ➔ Токио')

    // Hotel
    expect(ics).not.toContain('Park Hyatt Tokyo')
    expect(ics).not.toContain('HOTEL-999')

    // Day
    expect(ics).toContain('Прибытие и заселение')

    // Activity
    expect(ics).toContain('Обед в рамэнной')
    expect(ics).toContain('Shinjuku\\, Tokyo')
  })

  it('respects options to exclude sections', () => {
    const cal = generateTripCalendar(
      {
        trip: sampleTrip,
        days: sampleDays,
        bookings: sampleBookings,
      },
      {
        includeBookings: false,
        includeActivities: false,
        includeDaySummaries: true,
      },
    )

    const ics = cal.toString()
    expect(ics).toContain('Прибытие и заселение')
    expect(ics).not.toContain('SU-260')
    expect(ics).not.toContain('Обед в рамэнной')
  })
})
