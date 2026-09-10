import type { Booking, CarData, CarKind, OtherData, OtherKind, TrainData } from '../types'
import { classifyTransportText, ICON_TO_TARGET } from './transport-classifier'

/**
 * Разовая миграция уже импортированных бронирований под новую схему разделов:
 *
 * - записи, которые старый парсер складывал в `train` («🚌 Автобус», «⛴️ Паром»),
 *   переносятся в `car`/`other` с пометкой `kind`;
 * - записи `car` получают пометку (`такси`, `трансфер`, `аренда`, …);
 * - перемещения без автомобиля (паром, катер, канатка, велосипед) уезжают
 *   из «Авто» в «Другое».
 *
 * Признак определяется тем же классификатором, что и при импорте
 * (`lib/transport-classifier.ts`), по сохранившимся деталям записи: `company`,
 * `carType`, `notes` и заголовку. Если текста не хватает, используется иконка.
 */

export interface BookingChange {
  id: string
  title: string
  from: string
  to: string
}

export interface ReclassifyResult {
  bookings: Booking[]
  changes: BookingChange[]
}

function trainToCar(data: TrainData, kind: CarKind): CarData {
  return {
    kind,
    pickupLocation: data.departureStation,
    dropoffLocation: data.arrivalStation,
    pickupCoords: data.departureStationLocation,
    dropoffCoords: data.arrivalStationLocation,
    pickupDateTime: data.departureDateTime,
    dropoffDateTime: data.arrivalDateTime,
    pickupTimeZone: data.departureTimeZone,
    dropoffTimeZone: data.arrivalTimeZone,
    confirmationNumber: data.bookingReference,
    notes: data.notes,
    sourceUrl: data.sourceUrl,
  }
}

function trainToOther(data: TrainData, kind: OtherKind): OtherData {
  return {
    kind,
    startLocation: data.departureStation,
    endLocation: data.arrivalStation,
    startCoords: data.departureStationLocation,
    endCoords: data.arrivalStationLocation,
    startDateTime: data.departureDateTime,
    endDateTime: data.arrivalDateTime,
    startTimeZone: data.departureTimeZone,
    endTimeZone: data.arrivalTimeZone,
    bookingReference: data.bookingReference,
    notes: data.notes,
    sourceUrl: data.sourceUrl,
  }
}

function carToOther(data: CarData, kind: OtherKind): OtherData {
  return {
    kind,
    name: data.company ?? data.carType,
    startLocation: data.pickupLocation,
    endLocation: data.dropoffLocation,
    startCoords: data.pickupCoords,
    endCoords: data.dropoffCoords,
    startDateTime: data.pickupDateTime,
    endDateTime: data.dropoffDateTime,
    startTimeZone: data.pickupTimeZone,
    endTimeZone: data.dropoffTimeZone,
    bookingReference: data.confirmationNumber,
    notes: data.notes,
    sourceUrl: data.sourceUrl,
  }
}

function describe(booking: Booking): string {
  const kind = booking.type === 'car' || booking.type === 'other' ? booking.data.kind : undefined
  return kind ? `${booking.type}/${kind}` : `${booking.type}/—`
}

/**
 * Пересобирает список бронирований под новую схему разделов.
 * Функция чистая: возвращает новые объекты и список изменений для отчёта.
 */
export function reclassifyBookings(bookings: Booking[]): ReclassifyResult {
  const changes: BookingChange[] = []

  const next = bookings.map((booking) => {
    const details = booking.type === 'car'
      ? [booking.data.company, booking.data.carType, booking.data.notes]
      : booking.type === 'train'
        ? [booking.data.notes]
        : [booking.data.notes]

    const haystack = [...details, booking.title].filter(Boolean).join(' | ')

    const textTarget = classifyTransportText(haystack, booking.title)
    const iconTarget = ICON_TO_TARGET[booking.icon]
    const target = textTarget.matched
      ? textTarget
      : iconTarget
        ? { ...iconTarget, icon: booking.icon, matched: true }
        : textTarget

    const migrated = migrate(booking, target)
    if (migrated !== booking) {
      changes.push({ id: booking.id, title: booking.title, from: describe(booking), to: describe(migrated) })
    }
    return migrated
  })

  return { bookings: next, changes }
}

function migrate(booking: Booking, target: ReturnType<typeof classifyTransportText>): Booking {
  // Поезда остаются поездами, если классификатор не распознал в записи
  // автомобиль или «другое» перемещение
  if (booking.type === 'train') {
    if (!target.matched || target.type === 'train')
      return booking
    if (target.type === 'car') {
      // Общее слово «авто» в заголовке (например, «Автовокзал ➔ …») не повод
      // тащить поезд в раздел «Авто»
      if (target.kind === 'personal')
        return booking
      return { ...booking, type: 'car', icon: target.icon, data: trainToCar(booking.data, target.kind as CarKind) }
    }
    return { ...booking, type: 'other', icon: target.icon, data: trainToOther(booking.data, target.kind as OtherKind) }
  }

  if (booking.type === 'car') {
    if (target.matched && target.type === 'other')
      return { ...booking, type: 'other', icon: target.icon, data: carToOther(booking.data, target.kind as OtherKind) }
    const kind = target.kind as CarKind | undefined
    if (!kind || booking.data.kind === kind)
      return booking
    return { ...booking, icon: target.icon ?? booking.icon, data: { ...booking.data, kind } }
  }

  return booking
}
