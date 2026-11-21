export function formatActivityDay(dayUtc: string, isToday: boolean): string {
  if (isToday)
    return 'Сегодня'

  return new Date(`${dayUtc}T12:00:00Z`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export function formatActivityDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toFixed(1)} км`
}

export function formatActivityDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)

  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
}

export function formatActivityTime(ts: number | null, timeZone?: string): string {
  return ts ? new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }) : '--:--'
}
