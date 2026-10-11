import type { Booking } from '../models/types'
import { BOOKING_TYPES_CONFIG } from '../composables/use-booking-section'
import { resolveBookingKind } from '../models/booking-kinds'

const labels = {
  flight: 'Перелёт',
  hotel: 'Проживание',
  train: 'Поезд',
  car: 'Авто',
  attraction: 'Место / событие',
  other: 'Перемещение',
}

function getStart(booking: Booking): string | undefined {
  switch (booking.type) {
    case 'flight': return booking.data.segments?.[0]?.departureDateTime
    case 'hotel': return booking.data.checkInDate
    case 'train': return booking.data.departureDateTime
    case 'car': return booking.data.pickupDateTime
    case 'attraction': return booking.data.dateTime
    case 'other': return booking.data.startDateTime
  }
}

export function getTimelineEntry(booking: Booking) {
  const start = getStart(booking)
  // Dates and times belong to the activity's location, not the viewer's timezone.
  const date = start?.match(/^\d{4}-\d{2}-\d{2}(?=T|$)/)?.[0]
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null
  const validDate = parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date!)
    ? date
    : undefined
  const time = validDate ? start?.match(/T((?:[01]\d|2[0-3]):[0-5]\d)/)?.[1] : undefined
  const kind = booking.type === 'car' || booking.type === 'other'
    ? resolveBookingKind(booking.type, booking.data.kind, booking.icon)
    : null

  return {
    booking,
    date: validDate,
    time,
    label: kind?.label || labels[booking.type],
    icon: kind?.icon || booking.icon || BOOKING_TYPES_CONFIG[booking.type].icon,
  }
}

export function groupTimelineBookings(bookings: Booking[]) {
  const groups: { key: string, date?: string, label: string, weekday: string, entries: ReturnType<typeof getTimelineEntry>[] }[] = []
  const entries = bookings.map(getTimelineEntry)
  for (const entry of [...entries.filter(entry => entry.date), ...entries.filter(entry => !entry.date)]) {
    let group = groups.at(-1)
    if (!group || group.date !== entry.date) {
      const date = entry.date ? new Date(`${entry.date}T00:00:00Z`) : null
      group = {
        key: entry.booking.id,
        date: entry.date,
        label: date
          ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
          : 'Без даты',
        weekday: date ? new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(date) : '',
        entries: [],
      }
      groups.push(group)
    }
    group.entries.push(entry)
  }
  return groups
}
