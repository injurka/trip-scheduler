import type { ICalCalendar } from 'ical-generator'
import type { TripCalendarInput, TripCalendarOptions } from './types'
import ical from 'ical-generator'
import { addActivityEvent } from './formatters/activity.formatter'
import { addBookingEvents } from './formatters/booking.formatter'
import { addDayEvent } from './formatters/day.formatter'

// ical-generator writes calendar-level name/description verbatim (unlike event TEXT).
function escapeCalendarText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

export function generateTripCalendar(
  input: TripCalendarInput,
  options: TripCalendarOptions = {},
): ICalCalendar {
  const { trip, days = [], bookings = [] } = input
  const {
    includeDaySummaries = false,
    includeActivities = true,
    includeBookings = true,
    calendarName = trip.title,
  } = options

  const calendar = ical({
    name: escapeCalendarText(calendarName),
    description: trip.description ? escapeCalendarText(trip.description) : undefined,
    url: trip.url || undefined,
  })

  // A daily itinerary is the schedule of record. Booking timestamps are absolute
  // instants and must not be mixed with (or duplicate) its local wall-clock plan.
  const itineraryDates = new Set(includeActivities
    ? days.filter(day => day.date && day.activities?.length).map(day => day.date!)
    : [])

  // Bookings fill dates without a scheduled itinerary; they remain available alone.
  if (includeBookings && bookings.length > 0) {
    for (const booking of bookings) {
      addBookingEvents(calendar, booking, trip, options, itineraryDates)
    }
  }

  // 2. Дни путешествия и активности
  for (let i = 0; i < days.length; i++) {
    const day = days[i]

    if (includeDaySummaries && day.date) {
      addDayEvent(calendar, day, i, trip, options)
    }

    if (includeActivities && day.activities && day.activities.length > 0) {
      for (const activity of day.activities) {
        addActivityEvent(calendar, activity, day, trip, options)
      }
    }
  }

  return calendar
}

export function generateTripCalendarIcs(
  input: TripCalendarInput,
  options: TripCalendarOptions = {},
): string {
  const cal = generateTripCalendar(input, options)
  return cal.toString()
}
