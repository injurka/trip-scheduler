import type { Booking } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/models/types'
import { describe, expect, it } from 'bun:test'
import { groupTimelineBookings } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/lib/booking-timeline'

describe('booking timeline ordering and flight splitting', () => {
  it('splits a long layover flight around transit buses and hotel in chronological order (Moscow -> Guangzhou -> Taipei)', () => {
    const bookings: Booking[] = [
      {
        id: 'hotel-gz',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Southern Airlines Pearl Hotel (North District)',
        data: {
          hotelName: 'Southern Airlines Pearl Hotel (North District)',
          address: 'Гуанчжоу',
          checkInDate: '2026-11-05',
          checkOutDate: '2026-11-06',
        },
      },
      {
        id: 'hotel-tpe',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Dongmen Hotel',
        data: {
          hotelName: 'Dongmen Hotel',
          address: 'Тайбэй',
          checkInDate: '2026-11-06',
          checkOutDate: '2026-11-10',
        },
      },
      {
        id: 'flight-mow-tpe',
        type: 'flight',
        icon: 'mdi:airplane',
        title: 'Москва - Тайбэй',
        data: {
          segments: [
            {
              flightNumber: 'CZ656',
              departureCity: 'Москва',
              departureAirport: 'SVO',
              departureDateTime: '2026-11-04T23:15:00',
              departureTimeZone: '+03:00',
              arrivalCity: 'Гуанчжоу',
              arrivalAirport: 'CAN',
              arrivalDateTime: '2026-11-05T14:00:00',
              arrivalTimeZone: '+08:00',
            },
            {
              flightNumber: 'CZ3097',
              departureCity: 'Гуанчжоу',
              departureAirport: 'CAN',
              departureDateTime: '2026-11-06T12:00:00',
              departureTimeZone: '+08:00',
              arrivalCity: 'Тайбэй',
              arrivalAirport: 'TPE',
              arrivalDateTime: '2026-11-06T14:15:00',
              arrivalTimeZone: '+08:00',
            },
          ],
        },
      },
      {
        id: 'bus-to-hotel',
        type: 'car',
        icon: 'mdi:bus',
        title: 'CAN-T2 → Pearl Hotel North',
        data: {
          kind: 'bus',
          pickupLocation: 'CAN-T2',
          dropoffLocation: 'Pearl Hotel North',
          pickupDateTime: '2026-11-05T16:00:00',
          dropoffDateTime: '2026-11-05T17:00:00',
          pickupTimeZone: '+08:00',
          dropoffTimeZone: '+08:00',
        },
      },
      {
        id: 'bus-to-airport',
        type: 'car',
        icon: 'mdi:bus',
        title: 'Pearl Hotel North → CAN-T2',
        data: {
          kind: 'bus',
          pickupLocation: 'Pearl Hotel North',
          dropoffLocation: 'CAN-T2',
          pickupDateTime: '2026-11-06T08:00:00',
          dropoffDateTime: '2026-11-06T09:00:00',
          pickupTimeZone: '+08:00',
          dropoffTimeZone: '+08:00',
        },
      },
    ]

    const groups = groupTimelineBookings(bookings)

    expect(groups.map(g => g.date)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06'])

    // 4 Nov: First segment of flight
    expect(groups[0].entries.map(e => ({ id: e.id, range: e.segmentRange, sublabel: e.sublabel }))).toEqual([
      {
        id: 'flight-mow-tpe:seg-0-0',
        range: { start: 0, end: 0 },
        sublabel: 'Москва - Тайбэй · 1/2',
      },
    ])

    // 5 Nov: Bus to hotel (16:00) -> Hotel check-in (after 17:00 bus arrival)
    expect(groups[1].entries.map(e => e.id)).toEqual(['bus-to-hotel', 'hotel-gz'])
    expect(groups[1].entries[1].time).toBeUndefined()

    // 6 Nov: Bus to airport (08:00) -> Second segment of flight (12:00) -> Taipei hotel check-in
    expect(groups[2].entries.map(e => ({ id: e.id, range: e.segmentRange }))).toEqual([
      { id: 'bus-to-airport', range: undefined },
      { id: 'flight-mow-tpe:seg-1-1', range: { start: 1, end: 1 } },
      { id: 'hotel-tpe', range: undefined },
    ])
  })

  it('places hotel check-in after all intercity transfers on the check-in day (Xiaoliuqiu -> Taichung)', () => {
    const bookings: Booking[] = [
      {
        id: 'hotel-taichung',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Nagahiro Hotel- Taichung Wenxin',
        data: {
          hotelName: 'Nagahiro Hotel- Taichung Wenxin',
          checkInDate: '2026-11-22',
          checkOutDate: '2026-11-28',
        },
      },
      {
        id: 'ferry',
        type: 'other',
        icon: 'mdi:ferry',
        title: 'Xiaoliuqiu → Donggang',
        data: {
          kind: 'ferry',
          startDateTime: '2026-11-22T14:00:00',
          endDateTime: '2026-11-22T14:20:00',
        },
      },
      {
        id: 'bus-9127d',
        type: 'car',
        icon: 'mdi:bus',
        title: 'Donggang → THSR Zuoying',
        data: {
          kind: 'bus',
          pickupDateTime: '2026-11-22T14:38:00',
          dropoffDateTime: '2026-11-22T15:33:00',
        },
      },
      {
        id: 'train-1',
        type: 'train',
        icon: 'mdi:train',
        title: 'Xin Zuoying → Tainan',
        data: {
          departureDateTime: '2026-11-22T15:33:00',
          arrivalDateTime: '2026-11-22T16:25:00',
        },
      },
      {
        id: 'taxi-luggage',
        type: 'car',
        icon: 'mdi:taxi',
        title: 'Tainan TRA → Yoshi → Tainan TRA',
        data: {
          kind: 'taxi',
          pickupDateTime: '2026-11-22T16:25:00',
          dropoffDateTime: '2026-11-22T17:25:00',
        },
      },
      {
        id: 'train-2',
        type: 'train',
        icon: 'mdi:train',
        title: 'Tainan → Taichung',
        data: {
          departureDateTime: '2026-11-22T18:24:00',
          arrivalDateTime: '2026-11-22T20:19:00',
        },
      },
    ]

    const groups = groupTimelineBookings(bookings)

    expect(groups).toHaveLength(1)
    expect(groups[0].entries.map(e => e.id)).toEqual([
      'ferry',
      'bus-9127d',
      'train-1',
      'taxi-luggage',
      'train-2',
      'hotel-taichung',
    ])
  })

  it('keeps short airport connections without intervening bookings as a single flight card', () => {
    const bookings: Booking[] = [
      {
        id: 'flight-short-connection',
        type: 'flight',
        icon: 'mdi:airplane',
        title: 'Тайбэй - Москва',
        data: {
          segments: [
            {
              flightNumber: 'CA186',
              departureCity: 'Тайбэй',
              departureDateTime: '2026-11-28T21:00:00',
              departureTimeZone: '+08:00',
              arrivalCity: 'Пекин',
              arrivalDateTime: '2026-11-29T00:20:00',
              arrivalTimeZone: '+08:00',
            },
            {
              flightNumber: 'CA909',
              departureCity: 'Пекин',
              departureDateTime: '2026-11-29T02:30:00',
              departureTimeZone: '+08:00',
              arrivalCity: 'Москва',
              arrivalDateTime: '2026-11-29T06:00:00',
              arrivalTimeZone: '+03:00',
            },
          ],
        },
      },
    ]

    const groups = groupTimelineBookings(bookings)

    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('2026-11-28')
    expect(groups[0].entries).toHaveLength(1)
    expect(groups[0].entries[0].segmentRange).toBeUndefined()
  })

  it('respects linked check-in activity in trip days and manual checkInTime override, ignoring legacy T00:00:00', () => {
    const bookings: Booking[] = [
      {
        id: 'hotel-legacy-midnight',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'City Hotel',
        data: {
          checkInDate: '2026-11-10T00:00:00',
          checkOutDate: '2026-11-12T00:00:00',
        },
      },
      {
        id: 'morning-train',
        type: 'train',
        icon: 'mdi:train',
        title: 'Taipei → Hualien',
        data: {
          departureDateTime: '2026-11-10T09:00:00',
          arrivalDateTime: '2026-11-10T11:15:00',
        },
      },
      {
        id: 'evening-taxi',
        type: 'car',
        icon: 'mdi:taxi',
        title: 'Hotel → Night Market',
        data: {
          kind: 'taxi',
          pickupDateTime: '2026-11-10T19:00:00',
          dropoffDateTime: '2026-11-10T19:20:00',
        },
      },
      {
        id: 'evening-cablecar',
        type: 'other',
        icon: 'mdi:gondola',
        title: 'Maokong Gondola',
        data: {
          kind: 'cablecar',
          startDateTime: '2026-11-10T17:30:00',
          endDateTime: '2026-11-10T18:00:00',
        },
      },
    ]

    // With linked check-in activity at 15:30 in trip plan, hotel goes after morning train (09:00) and before gondola (17:30) & dinner taxi (19:00)
    const groupsFromPlan = groupTimelineBookings(bookings, {
      days: [
        {
          date: '2026-11-10',
          activities: [
            {
              title: 'Заселение в City Hotel',
              startTime: '15:30',
              sections: [{ type: 'booking', bookingId: 'hotel-legacy-midnight' }],
            },
            {
              title: 'Возвращение в отель',
              startTime: '22:00',
              sections: [{ type: 'booking', bookingId: 'hotel-legacy-midnight' }],
            },
          ],
        },
      ],
    })

    expect(groupsFromPlan[0].entries.map(e => e.id)).toEqual([
      'morning-train',
      'hotel-legacy-midnight',
      'evening-cablecar',
      'evening-taxi',
    ])

    // Manual checkInTime override places hotel after evening-taxi if set to 20:00
    const manualBookings: Booking[] = bookings.map(b =>
      b.id === 'hotel-legacy-midnight' && b.type === 'hotel'
        ? { ...b, data: { ...b.data, checkInTime: '20:00' } }
        : b)

    const groupsFromManual = groupTimelineBookings(manualBookings)
    expect(groupsFromManual[0].entries.map(e => e.id)).toEqual([
      'morning-train',
      'evening-cablecar',
      'evening-taxi',
      'hotel-legacy-midnight',
    ])
  })
})
