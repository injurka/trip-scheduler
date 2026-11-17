import { parseDate } from '@internationalized/date'

/** Calendar dates are interpreted in an explicit IANA zone; instants remain UTC. */
export function calendarDay(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp)
  const value = (type: string) => parts.find(p => p.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function calendarDayBounds(day: string, timeZone = 'UTC'): { from: Date, to: Date } {
  const date = parseDate(day)
  if (date.toString() !== day)
    throw new Error('Некорректная дата')
  // Adding a calendar day preserves 23/25-hour days at DST changes.
  return { from: date.toDate(timeZone), to: date.add({ days: 1 }).toDate(timeZone) }
}

export function isTimeZone(value: string): boolean {
  try {
    return Boolean(new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone)
  }
  catch { return false }
}
