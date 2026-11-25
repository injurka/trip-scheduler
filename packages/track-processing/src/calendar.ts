import { parseDate } from '@internationalized/date'

const dayFormatters = new Map<string, Intl.DateTimeFormat>()
const validTimeZones = new Map<string, boolean>()

function getDayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    if (dayFormatters.size > 200)
      dayFormatters.clear()
    dayFormatters.set(timeZone, formatter)
  }
  return formatter
}

/** Calendar dates are interpreted in an explicit IANA zone; instants remain UTC. */
export function calendarDay(timestamp: number, timeZone: string): string {
  const parts = getDayFormatter(timeZone).formatToParts(timestamp)
  let year = ''
  let month = ''
  let day = ''
  for (const p of parts) {
    if (p.type === 'year')
      year = p.value
    else if (p.type === 'month')
      month = p.value
    else if (p.type === 'day')
      day = p.value
  }
  return `${year}-${month}-${day}`
}

export function calendarDayBounds(day: string, timeZone = 'UTC'): { from: Date, to: Date } {
  const date = parseDate(day)
  if (date.toString() !== day)
    throw new Error('Некорректная дата')
  // Adding a calendar day preserves 23/25-hour days at DST changes.
  return { from: date.toDate(timeZone), to: date.add({ days: 1 }).toDate(timeZone) }
}

export function isTimeZone(value: string): boolean {
  const cached = validTimeZones.get(value)
  if (cached !== undefined)
    return cached
  try {
    const valid = Boolean(new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone)
    if (validTimeZones.size > 500)
      validTimeZones.clear()
    validTimeZones.set(value, valid)
    return valid
  }
  catch {
    validTimeZones.set(value, false)
    return false
  }
}
