import { Time } from '@internationalized/date'

/**
 * Преобразует UTC дату в локальную дату, используя смещение в минутах.
 * @param utcDate - Дата в формате UTC (объект Date или строка).
 * @param offsetMinutes - Смещение часового пояса в минутах.
 * @returns Объект Date, представляющий локальное время.
 */
export function getLocalDate(utcDate: Date | string, offsetMinutes: number): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate

  // Получаем время в миллисекундах и прибавляем смещение (в миллисекундах)
  const localTime = date.getTime() + offsetMinutes * 60 * 1000

  return new Date(localTime)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)

  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function formatDate(dateString: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(dateString))
}

/**
 * Форматирует ISO timestamp строку в HH:mm (UTC).
 * '2024-05-01T14:30:00.000Z' → '14:30'
 */
export function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp)
  const hours = d.getUTCHours().toString().padStart(2, '0')
  const minutes = d.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Создаёт объект Time из UTC-часов и минут ISO timestamp строки.
 * Удобно для KitTimeField / internationalizeddate Time.
 */
export function getTimeFromTimestamp(timestamp: string): Time {
  const d = new Date(timestamp)
  return new Time(d.getUTCHours(), d.getUTCMinutes())
}

/**
 * Форматирует числа hour/minute в строку HH:mm.
 * Используется когда уже есть Time объект (из use-memory-image-viewer).
 */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
