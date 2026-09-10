/**
 * Каталог пометок («тегов») для типов бронирований, которые сами по себе
 * слишком абстрактны.
 *
 * Например, раздел `car` («Авто») вмещает такси, трансфер, аренду, личное авто
 * и автобус, а раздел `other` («Другое») — паромы, канатные дороги,
 * электровелосипеды и прочие неочевидные способы перемещения. Пометка `kind`
 * даёт мгновенно понятный визуальный признак: иконка + подпись + цвет.
 */

/**
 * Цветовой токен пометки. Сопоставляется с CSS-классом `is-<token>` в
 * `BookingKindBadge` (инлайн-стили в проекте запрещены).
 */
export type BookingKindToken = 'accent' | 'info' | 'success' | 'warning' | 'action' | 'muted' | 'muted-strong'

export interface BookingKindMeta<T extends string = string> {
  value: T
  label: string
  icon: string
  token: BookingKindToken
}

/**
 * Пометки для типа `car`.
 */
export const CAR_KINDS = [
  { value: 'taxi', label: 'Такси', icon: 'mdi:taxi', token: 'warning' },
  { value: 'transfer', label: 'Трансфер', icon: 'mdi:airport-shuttle', token: 'info' },
  { value: 'chauffeur', label: 'Авто с водителем', icon: 'mdi:car-connected', token: 'accent' },
  { value: 'rental', label: 'Аренда авто', icon: 'mdi:car-key', token: 'success' },
  { value: 'personal', label: 'Личное авто', icon: 'mdi:car', token: 'action' },
  { value: 'bus', label: 'Автобус', icon: 'mdi:bus', token: 'info' },
  { value: 'bike', label: 'Вело / мото', icon: 'mdi:moped', token: 'success' },
  { value: 'other', label: 'Прочее авто', icon: 'mdi:help-circle-outline', token: 'muted' },
] as const satisfies readonly BookingKindMeta[]

/**
 * Пометки для типа `other`.
 */
export const OTHER_KINDS = [
  { value: 'ferry', label: 'Паром / корабль', icon: 'mdi:ferry', token: 'info' },
  { value: 'boat', label: 'Катер / лодка', icon: 'mdi:sail-boat', token: 'info' },
  { value: 'cablecar', label: 'Канатная дорога', icon: 'mdi:gondola', token: 'accent' },
  { value: 'bike', label: 'Вело / самокат', icon: 'mdi:bike', token: 'success' },
  { value: 'pedestrian', label: 'Пеший переход', icon: 'mdi:walk', token: 'action' },
  { value: 'luggage', label: 'Багаж / перевозка', icon: 'mdi:bag-checked', token: 'warning' },
  { value: 'other', label: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', token: 'muted' },
] as const satisfies readonly BookingKindMeta[]

export type CarKind = typeof CAR_KINDS[number]['value']
export type OtherKind = typeof OTHER_KINDS[number]['value']

/**
 * Соответствие типа бронирования и доступных для него пометок.
 */
export const BOOKING_KINDS: Record<string, readonly BookingKindMeta[]> = {
  car: CAR_KINDS,
  other: OTHER_KINDS,
}

/**
 * Иконки, по которым можно восстановить пометку у старых записей,
 * созданных парсером до появления поля `kind`.
 */
const ICON_KIND_HINTS: Record<string, string> = {
  'mdi:taxi': 'taxi',
  'mdi:airport-shuttle': 'transfer',
  'mdi:car-key': 'rental',
  'mdi:car-connected': 'chauffeur',
  // Старый парсер ставил всем машинам mdi:car без пометки: конкретный вид неизвестен,
  // поэтому честнее показать «Прочее авто», а не «Личное авто»
  'mdi:car': 'other',
  'mdi:bus': 'bus',
  'mdi:moped': 'bike',
  'mdi:bike': 'bike',
  'mdi:ferry': 'ferry',
  'mdi:sail-boat': 'boat',
  'mdi:gondola': 'cablecar',
  'mdi:walk': 'pedestrian',
  'mdi:bag-checked': 'luggage',
  'mdi:transit-transfer': 'other',
}

/**
 * Возвращает доступные пометки для типа бронирования.
 */
export function getBookingKindOptions(type: string): BookingKindMeta[] {
  return [...(BOOKING_KINDS[type] || [])]
}

/**
 * Возвращает описание пометки по её значению.
 */
export function getBookingKindMeta(type: string, kind?: string | null): BookingKindMeta | null {
  if (!kind)
    return null
  return BOOKING_KINDS[type]?.find(item => item.value === kind) || null
}

/**
 * Пытается определить пометку по иконке бронирования (для записей без `kind`).
 */
export function inferBookingKind(type: string, icon?: string | null): BookingKindMeta | null {
  if (!icon)
    return null
  const hinted = ICON_KIND_HINTS[icon]
  if (!hinted)
    return null
  return getBookingKindMeta(type, hinted)
}

/**
 * Возвращает пометку бронирования: явную, а при её отсутствии — выведенную из иконки.
 */
export function resolveBookingKind(type: string, kind?: string | null, icon?: string | null): BookingKindMeta | null {
  return getBookingKindMeta(type, kind) || inferBookingKind(type, icon)
}
