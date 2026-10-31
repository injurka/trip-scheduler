import type { ICalCalendar } from 'ical-generator'
import type { TripCalendarDay, TripCalendarOptions, TripCalendarTrip } from '../types'
import { calendarPlainText } from '../plain-text'

export function addDayEvent(
  calendar: ICalCalendar,
  day: TripCalendarDay,
  index: number,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  if (!day.date)
    return

  const dateStr = day.date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return

  const summary = `📍 [День ${index + 1}] ${day.title || 'Маршрут дня'}`

  const descLines: string[] = []

  if (day.description)
    descLines.push(calendarPlainText(day.description))

  if (day.meta && day.meta.length > 0) {
    const metaStr = day.meta
      .map(m => (m.subtitle ? `${m.title}: ${m.subtitle}` : m.title))
      .filter(Boolean)
      .join(' | ')
    if (metaStr) {
      descLines.push(`\nИнфо: ${metaStr}`)
    }
  }

  if (options.includeActivities !== false && day.activities && day.activities.length > 0) {
    descLines.push('\nПлан на день:')
    for (const act of day.activities) {
      descLines.push(`  • [${act.startTime} - ${act.endTime}] ${act.title}`)
    }
  }

  if (trip.url) {
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)
  }

  calendar.createEvent({
    id: `day-${day.id}`,
    start: dateStr,
    allDay: true,
    summary,
    description: descLines.join('\n').trim() || undefined,
    url: trip.url || undefined,
  })
}
