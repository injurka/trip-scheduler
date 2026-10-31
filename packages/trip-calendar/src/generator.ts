import type { ICalCalendar } from 'ical-generator'
import type { TripCalendarInput, TripCalendarOptions } from './types'
import ical from 'ical-generator'
import { addActivityEvent } from './formatters/activity.formatter'
import { addBookingEvents } from './formatters/booking.formatter'
import { addDayEvent } from './formatters/day.formatter'

export function generateTripCalendar(
  input: TripCalendarInput,
  options: TripCalendarOptions = {},
): ICalCalendar {
  const { trip, days = [], bookings = [] } = input
  const {
    includeDaySummaries = true,
    includeActivities = true,
    includeBookings = true,
    calendarName = trip.title,
  } = options

  const calendar = ical({
    name: calendarName,
    description: trip.description || undefined,
    url: trip.url || undefined,
  })

  // 1. Бронирования (перелеты, отели, поезда, авто и др.)
  if (includeBookings && bookings.length > 0) {
    for (const booking of bookings) {
      addBookingEvents(calendar, booking, trip, options)
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
