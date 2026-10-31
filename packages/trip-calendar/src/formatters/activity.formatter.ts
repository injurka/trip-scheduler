import type { ICalCalendar } from 'ical-generator'
import type { TripCalendarActivity, TripCalendarDay, TripCalendarOptions, TripCalendarTrip } from '../types'
import { ICalAlarmType } from 'ical-generator'

function stripMarkdown(text: string): string {
  if (!text)
    return ''

  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^#+\s/gm, '')
    .trim()
}

function getTagEmoji(tag?: string | null): string {
  switch (tag) {
    case 'food':
      return '🍽️'
    case 'walk':
      return '🚶'
    case 'attraction':
      return '🏛️'
    case 'relax':
      return '☕'
    case 'transport':
      return '🚌'
    default:
      return '📌'
  }
}

function parseTimeToDate(dateStr: string, timeStr: string): Date {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number)
  const [year = 2000, month = 1, day = 1] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
}

export function addActivityEvent(
  calendar: ICalCalendar,
  activity: TripCalendarActivity,
  day: TripCalendarDay,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  if (!day.date)
    return

  const dateStr = day.date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return

  const startParsed = parseTimeToDate(dateStr, activity.startTime || '09:00')
  let endParsed = parseTimeToDate(dateStr, activity.endTime || activity.startTime || '10:00')

  if (endParsed.getTime() <= startParsed.getTime()) {
    // Если время окончания меньше или равно времени начала — добавляем 1 час
    endParsed = new Date(startParsed.getTime() + 60 * 60 * 1000)
  }

  const emoji = getTagEmoji(activity.tag)
  const summary = `${emoji} ${activity.title}`

  const descLines: string[] = []
  let locationTitle: string | undefined
  let geo: { lat: number, lon: number } | undefined

  if (activity.sections && activity.sections.length > 0) {
    for (const section of activity.sections) {
      if (section.type === 'description' && section.text) {
        descLines.push(stripMarkdown(section.text))
      }
      else if (section.type === 'geolocation') {
        if (section.address) {
          locationTitle = section.address
        }
        if (section.points && section.points.length > 0) {
          const firstPoint = section.points[0]
          if (firstPoint.address && !locationTitle) {
            locationTitle = firstPoint.address
          }
          if (firstPoint.lat && (firstPoint.lon || firstPoint.lng)) {
            geo = {
              lat: firstPoint.lat,
              lon: (firstPoint.lon ?? firstPoint.lng) as number,
            }
          }
        }
      }
      else if (section.type === 'metro' && Array.isArray(section.rides)) {
        const rideDetails = section.rides
          .map((r: any) => `${r.startStation} ➔ ${r.endStation} (${r.lineName || ''})`)
          .join('\n  ')
        if (rideDetails) {
          descLines.push(`\nМетро:\n  ${rideDetails}`)
        }
      }
      else if (section.type === 'bus' && Array.isArray(section.rides)) {
        const busDetails = section.rides
          .map((r: any) => `${r.from} ➔ ${r.to} (${r.route || ''})`)
          .join('\n  ')
        if (busDetails) {
          descLines.push(`\nАвтобус:\n  ${busDetails}`)
        }
      }
    }
  }

  if (trip.url) {
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)
  }

  const locationProp = locationTitle
    ? (geo ? { title: locationTitle, geo } : locationTitle)
    : undefined

  const event = calendar.createEvent({
    id: `act-${activity.id}`,
    start: startParsed,
    end: endParsed,
    floating: true,
    summary,
    description: descLines.join('\n').trim() || undefined,
    location: locationProp,
    url: trip.url || undefined,
  })

  if (options.enableAlarms !== false) {
    event.createAlarm({
      type: ICalAlarmType.display,
      trigger: 30 * 60, // за 30 минут
      description: summary,
    })
  }
}
