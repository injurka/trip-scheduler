import { cleanId } from '~/lib/helpers'

// Маппер для дня
export function mapDay(day: any) {
  if (!day)
    return null
  return {
    ...day,
    id: cleanId(day.id.toString()),
    tripId: cleanId(day.tripId.toString()),
    // Преобразуем даты в объекты Date, если они пришли строками
    date: new Date(day.date),
    createdAt: new Date(day.createdAt),
    updatedAt: new Date(day.updatedAt),
    activities: Array.isArray(day.activities)
      ? day.activities.map((a: any) => ({
        ...a,
        id: cleanId(a.id.toString()),
        dayId: cleanId(a.dayId.toString()),
      }))
      : [],
  }
}
