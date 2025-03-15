export enum ActivityType {
  TRANSPORT = 'transport',
  WALK = 'walk',
  FOOD = 'food',
  ATTRACTION = 'attraction',
  RELAX = 'relax',
}

export interface ActivityBlock {
  id: string
  type: ActivityType
  description: string
  startTime?: string // Относительное время начала в рамках активности
  duration?: number // Длительность в минутах
  location?: string
  notes?: string
}

export interface Activity {
  id: string
  day: number
  startTime: string // Формат "HH:mm"
  endTime: string // Формат "HH:mm"
  type: ActivityType
  description: string
  location?: string
  links?: string[]
  images?: string[]
  blocks?: ActivityBlock[] // Подблоки активности (такси, прогулка и т.д.)
}

// Вспомогательные функции
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function getActivityDuration(activity: Activity): number {
  return timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)
}

export const activityTypeIcons: Record<ActivityType, string> = {
  [ActivityType.TRANSPORT]: 'mdi-car',
  [ActivityType.WALK]: 'mdi-walk',
  [ActivityType.FOOD]: 'mdi-food',
  [ActivityType.ATTRACTION]: 'mdi-camera',
  [ActivityType.RELAX]: 'mdi-bed',
}

export const activityTypeColors: Record<ActivityType, string> = {
  [ActivityType.TRANSPORT]: '#e3f2fd', // светло-синий
  [ActivityType.WALK]: '#e8f5e9', // светло-зеленый
  [ActivityType.FOOD]: '#fff8e1', // светло-желтый
  [ActivityType.ATTRACTION]: '#f3e5f5', // светло-фиолетовый
  [ActivityType.RELAX]: '#e0f2f1', // светло-голубой
}
