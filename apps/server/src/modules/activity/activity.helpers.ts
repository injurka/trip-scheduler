import { cleanId } from "~/lib/helpers"

// Маппер активности
export function mapActivity(activity: any) {
  if (!activity)
    return null
  return {
    ...activity,
    id: cleanId(activity.id.toString()),
    dayId: cleanId(activity.dayId.toString()),
    // sections в Surreal хранятся как массив объектов, доп. парсинг не нужен, если это не JSON-строка
    sections: activity.sections || [],
  }
}
