import type { ICalCalendar } from 'ical-generator'
import type {
  AttractionData,
  CarData,
  FlightData,
  OtherData,
  TrainData,
  TripCalendarBooking,
  TripCalendarOptions,
  TripCalendarTrip,
} from '../types'
import { ICalAlarmType } from 'ical-generator'
import { calendarPlainText } from '../plain-text'

function parseIsoToDate(isoString?: string | null, offset?: string): Date | null {
  if (!isoString)
    return null
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoString)
  const withOffset = !hasZone && /^\d{4}-\d{2}-\d{2}T/.test(isoString) && offset && /^[+-]\d{2}:\d{2}$/.test(offset)
    ? `${isoString}${offset}`
    : isoString
  const date = new Date(withOffset)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addBookingEvents(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
  itineraryDates: ReadonlySet<string> = new Set(),
): void {
  const { type, data } = booking
  if (type !== 'flight') {
    const fields = data as Record<string, unknown> | undefined
    const start = fields?.departureDateTime || fields?.pickupDateTime || fields?.dateTime || fields?.startDateTime || fields?.date
    if (typeof start === 'string' && itineraryDates.has(start.slice(0, 10)))
      return
  }

  switch (type) {
    case 'flight':
      formatFlight(calendar, booking, data as FlightData, trip, options, itineraryDates)
      break
    case 'hotel':
      // Hotel bookings describe accommodation, not scheduled activities.
      // Check-in/out is exported only from the timed daily itinerary.
      break
    case 'train':
      formatTrain(calendar, booking, data as TrainData, trip, options)
      break
    case 'car':
      formatCar(calendar, booking, data as CarData, trip, options)
      break
    case 'attraction':
      formatAttraction(calendar, booking, data as AttractionData, trip, options)
      break
    case 'other':
      formatOther(calendar, booking, data as OtherData, trip, options)
      break
    default:
      formatGeneric(calendar, booking, trip, options)
      break
  }
}

function formatFlight(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  data: FlightData,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
  itineraryDates: ReadonlySet<string>,
): void {
  const segments = data?.segments || []
  if (segments.length === 0) {
    return
  }

  segments.forEach((seg, idx) => {
    if (seg.departureDateTime && itineraryDates.has(seg.departureDateTime.slice(0, 10)))
      return
    const start = parseIsoToDate(seg.departureDateTime, seg.departureTimeZone)
    if (!start)
      return

    const end = parseIsoToDate(seg.arrivalDateTime, seg.arrivalTimeZone) || new Date(start.getTime() + 2 * 60 * 60 * 1000)

    const flightNum = seg.flightNumber ? ` ${seg.flightNumber}` : ''
    const fromCity = seg.departureCity || seg.departureAirport || 'Вылет'
    const toCity = seg.arrivalCity || seg.arrivalAirport || 'Прилет'
    const summary = `✈️ [Рейс${flightNum}] ${fromCity} ➔ ${toCity}`

    const descLines: string[] = []
    if (seg.airline)
      descLines.push(`Авиакомпания: ${seg.airline}`)
    if (seg.flightNumber)
      descLines.push(`Рейс: ${seg.flightNumber}`)
    if (seg.seat)
      descLines.push(`Место: ${seg.seat}`)
    if (seg.terminalDeparture)
      descLines.push(`Терминал вылета: ${seg.terminalDeparture}`)
    if (seg.terminalArrival)
      descLines.push(`Терминал прилета: ${seg.terminalArrival}`)
    if (data.bookingReference)
      descLines.push(`Номер брони (PNR): ${data.bookingReference}`)
    if (data.notes)
      descLines.push(`\nЗаметки: ${data.notes}`)
    if (trip.url)
      descLines.push(`\nВ Trip Scheduler: ${trip.url}`)

    const locParts = [seg.departureAirport, seg.departureCity].filter(Boolean)
    const locTitle = locParts.join(', ') || undefined
    const locationProp = locTitle
      ? (seg.departureAirportLocation ? { title: locTitle, geo: { lat: seg.departureAirportLocation.lat, lon: seg.departureAirportLocation.lon } } : locTitle)
      : undefined

    const event = calendar.createEvent({
      id: `booking-${booking.id}-seg-${idx}`,
      start,
      end,
      summary,
      description: calendarPlainText(descLines.join('\n')) || undefined,
      location: locationProp,
      url: data.sourceUrl || trip.url || undefined,
    })

    if (options.enableAlarms !== false) {
      event.createAlarm({
        type: ICalAlarmType.display,
        trigger: 2 * 60 * 60, // за 2 часа
        description: summary,
      })
    }
  })
}

function formatTrain(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  data: TrainData,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  const start = parseIsoToDate(data?.departureDateTime, data?.departureTimeZone)
  if (!start)
    return

  const end = parseIsoToDate(data?.arrivalDateTime, data?.arrivalTimeZone) || new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const trainNum = data?.trainNumber ? ` ${data.trainNumber}` : ''
  const from = data?.departureStation || 'Отправление'
  const to = data?.arrivalStation || 'Прибытие'
  const summary = `🚆 [Поезд${trainNum}] ${from} ➔ ${to}`

  const descLines: string[] = []
  if (data?.trainNumber)
    descLines.push(`Поезд: ${data.trainNumber}`)
  if (data?.carriage)
    descLines.push(`Вагон: ${data.carriage}`)
  if (data?.seat)
    descLines.push(`Место: ${data.seat}`)
  if (data?.departurePlatform)
    descLines.push(`Платформа отправления: ${data.departurePlatform}`)
  if (data?.arrivalPlatform)
    descLines.push(`Платформа прибытия: ${data.arrivalPlatform}`)
  if (data?.bookingReference)
    descLines.push(`Бронь: ${data.bookingReference}`)
  if (data?.notes)
    descLines.push(`\nЗаметки: ${data.notes}`)
  if (trip.url)
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)

  const locTitle = data?.departureStation || undefined
  const locationProp = locTitle
    ? (data?.departureStationLocation ? { title: locTitle, geo: { lat: data.departureStationLocation.lat, lon: data.departureStationLocation.lon } } : locTitle)
    : undefined

  const event = calendar.createEvent({
    id: `booking-${booking.id}`,
    start,
    end,
    summary,
    description: calendarPlainText(descLines.join('\n')) || undefined,
    location: locationProp,
    url: data?.sourceUrl || trip.url || undefined,
  })

  if (options.enableAlarms !== false) {
    event.createAlarm({
      type: ICalAlarmType.display,
      trigger: 60 * 60, // за 1 час
      description: summary,
    })
  }
}

function formatCar(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  data: CarData,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  const start = parseIsoToDate(data?.pickupDateTime, data?.pickupTimeZone)
  if (!start)
    return

  const end = parseIsoToDate(data?.dropoffDateTime, data?.dropoffTimeZone) || new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const kind = data?.kind ? data.kind.toUpperCase() : 'АВТО'
  const label = data?.carModel || data?.company || booking.title
  const summary = `🚗 [${kind}] ${label}`

  const descLines: string[] = []
  if (data?.company)
    descLines.push(`Компания: ${data.company}`)
  if (data?.carModel)
    descLines.push(`Автомобиль: ${data.carModel} ${data.carType ? `(${data.carType})` : ''}`)
  if (data?.pickupLocation)
    descLines.push(`Получение: ${data.pickupLocation}`)
  if (data?.dropoffLocation)
    descLines.push(`Сдача: ${data.dropoffLocation}`)
  if (data?.confirmationNumber)
    descLines.push(`Номер брони: ${data.confirmationNumber}`)
  if (data?.notes)
    descLines.push(`\nЗаметки: ${data.notes}`)
  if (trip.url)
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)

  const locTitle = data?.pickupLocation || undefined
  const locationProp = locTitle
    ? (data?.pickupCoords ? { title: locTitle, geo: { lat: data.pickupCoords.lat, lon: data.pickupCoords.lon } } : locTitle)
    : undefined

  const event = calendar.createEvent({
    id: `booking-${booking.id}`,
    start,
    end,
    summary,
    description: calendarPlainText(descLines.join('\n')) || undefined,
    location: locationProp,
    url: data?.sourceUrl || trip.url || undefined,
  })

  if (options.enableAlarms !== false) {
    event.createAlarm({
      type: ICalAlarmType.display,
      trigger: 60 * 60,
      description: summary,
    })
  }
}

function formatAttraction(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  data: AttractionData,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  const start = parseIsoToDate(data?.dateTime)
  if (!start)
    return

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const name = data?.attractionName || booking.title
  const summary = `🎟️ ${name}`

  const descLines: string[] = []
  if (data?.ticketType)
    descLines.push(`Билет: ${data.ticketType}`)
  if (data?.guests)
    descLines.push(`Гости: ${data.guests}`)
  if (data?.bookingReference)
    descLines.push(`Бронь: ${data.bookingReference}`)
  if (data?.notes)
    descLines.push(`\nЗаметки: ${data.notes}`)
  if (trip.url)
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)

  const locTitle = data?.address || undefined
  const locationProp = locTitle
    ? (data?.location ? { title: locTitle, geo: { lat: data.location.lat, lon: data.location.lon } } : locTitle)
    : undefined

  const event = calendar.createEvent({
    id: `booking-${booking.id}`,
    start,
    end,
    summary,
    description: calendarPlainText(descLines.join('\n')) || undefined,
    location: locationProp,
    url: data?.sourceUrl || trip.url || undefined,
  })

  if (options.enableAlarms !== false) {
    event.createAlarm({
      type: ICalAlarmType.display,
      trigger: 60 * 60,
      description: summary,
    })
  }
}

function formatOther(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  data: OtherData,
  trip: TripCalendarTrip,
  options: TripCalendarOptions,
): void {
  const start = parseIsoToDate(data?.startDateTime, data?.startTimeZone)
  if (!start)
    return

  const end = parseIsoToDate(data?.endDateTime, data?.endTimeZone) || new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const name = data?.name || booking.title
  const summary = `🚢 ${name}`

  const descLines: string[] = []
  if (data?.startLocation)
    descLines.push(`Отправление: ${data.startLocation}`)
  if (data?.endLocation)
    descLines.push(`Прибытие: ${data.endLocation}`)
  if (data?.bookingReference)
    descLines.push(`Бронь: ${data.bookingReference}`)
  if (data?.notes)
    descLines.push(`\nЗаметки: ${data.notes}`)
  if (trip.url)
    descLines.push(`\nВ Trip Scheduler: ${trip.url}`)

  const locTitle = data?.startLocation || undefined
  const locationProp = locTitle
    ? (data?.startCoords ? { title: locTitle, geo: { lat: data.startCoords.lat, lon: data.startCoords.lon } } : locTitle)
    : undefined

  const event = calendar.createEvent({
    id: `booking-${booking.id}`,
    start,
    end,
    summary,
    description: calendarPlainText(descLines.join('\n')) || undefined,
    location: locationProp,
    url: data?.sourceUrl || trip.url || undefined,
  })

  if (options.enableAlarms !== false) {
    event.createAlarm({
      type: ICalAlarmType.display,
      trigger: 60 * 60,
      description: summary,
    })
  }
}

function formatGeneric(
  calendar: ICalCalendar,
  booking: TripCalendarBooking,
  trip: TripCalendarTrip,
  _options: TripCalendarOptions,
): void {
  const anyData = (booking.data || {}) as Record<string, any>
  const dateStr = anyData.dateTime || anyData.departureDateTime || anyData.startDateTime || anyData.date
  const start = parseIsoToDate(dateStr)
  if (!start)
    return

  const end = parseIsoToDate(anyData.arrivalDateTime || anyData.endDateTime) || new Date(start.getTime() + 60 * 60 * 1000)

  calendar.createEvent({
    id: `booking-${booking.id}`,
    start,
    end,
    summary: `📋 ${booking.title}`,
    description: anyData.notes ? calendarPlainText(anyData.notes) : undefined,
    url: trip.url || undefined,
  })
}
