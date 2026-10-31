import type { Booking, FlightSegment, FlightSegmentRange } from '../models/types'
import { BOOKING_TYPES_CONFIG } from '../constants/booking-types'
import { resolveBookingKind } from '../models/booking-kinds'

const labels = {
  flight: 'Перелёт',
  hotel: 'Проживание',
  train: 'Поезд',
  car: 'Авто',
  attraction: 'Место / событие',
  other: 'Перемещение',
} as const

const DEFAULT_HOTEL_CHECK_IN_MINUTES = 15 * 60
const UNTITLED_TIME_SORT_MINUTES = 24 * 60
const LONG_LAYOVER_THRESHOLD_MS = 6 * 60 * 60 * 1000
const NON_TRANSIT_OTHER_KINDS = new Set(['cablecar', 'bike', 'pedestrian', 'luggage'])
const CHECK_IN_ACTIVITY_RE = /заселен|чек-?ин|check-?in|заезд|регистрац/i

export interface TimelineDayActivitySection {
  type: string
  bookingId?: string
}

export interface TimelineDayActivity {
  title: string
  startTime: string
  endTime?: string
  sections?: TimelineDayActivitySection[]
}

export interface TimelineDayContext {
  date: string | null
  activities: TimelineDayActivity[]
}

export interface TimelineOptions {
  days?: TimelineDayContext[]
}

export interface TimelineEntry {
  id: string
  booking: Booking
  segmentRange?: FlightSegmentRange
  date?: string
  time?: string
  sublabel?: string
  label: string
  icon: string
  sortMinutes: number
  sortPriority: number
  originalIndex: number
}

export interface TimelineDayGroup {
  key: string
  date?: string
  label: string
  weekday: string
  entries: TimelineEntry[]
}

interface EventPoint {
  bookingId: string
  date: string
  minutes: number
}

interface DateTimeEndpoints {
  startDateTime?: string
  startTimeZone?: string
  endDateTime?: string
  endTimeZone?: string
}

function getValidTimelineDate(value?: string): string | undefined {
  const date = value?.match(/^\d{4}-\d{2}-\d{2}(?=T|$)/)?.[0]

  if (!date)
    return undefined

  const parsed = new Date(`${date}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(date))
    return undefined

  return date
}

function parseStandaloneTime(value?: string): string | undefined {
  if (!value)
    return undefined

  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)

  return match ? `${match[1]}:${match[2]}` : undefined
}

function getTimelineTime(start: string | undefined, date: string | undefined): string | undefined {
  if (!date)
    return undefined

  return start?.match(/T((?:[01]\d|2[0-3]):[0-5]\d)/)?.[1]
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)

  return hours * 60 + minutes
}

function compareDateAndMinutes(
  dateA: string,
  minA: number,
  dateB: string,
  minB: number,
): number {
  return dateA !== dateB ? dateA.localeCompare(dateB) : minA - minB
}

function parseTimestampWithTimezone(dateTime?: string, timeZone?: string): number | null {
  if (!dateTime || !dateTime.includes('T'))
    return null

  if (/Z|[+-]\d{2}(?::\d{2})?$/.test(dateTime)) {
    const ms = new Date(dateTime).getTime()

    return Number.isNaN(ms) ? null : ms
  }

  if (timeZone && /^[+-]\d{2}:\d{2}$/.test(timeZone.trim())) {
    const ms = new Date(`${dateTime}${timeZone.trim()}`).getTime()

    return Number.isNaN(ms) ? null : ms
  }

  return null
}

function parseWallClockMs(dateTime?: string): number | null {
  const date = getValidTimelineDate(dateTime)
  const time = getTimelineTime(dateTime, date)

  if (!date || !time)
    return null

  const ms = new Date(`${date}T${time}:00Z`).getTime()

  return Number.isNaN(ms) ? null : ms
}

function parseFlexibleTimestampMs(dateTime?: string, timeZone?: string): number | null {
  const withTz = parseTimestampWithTimezone(dateTime, timeZone)

  if (withTz !== null || !dateTime)
    return withTz

  const ms = new Date(dateTime).getTime()

  return Number.isNaN(ms) ? null : ms
}

function getLayoverDurationMs(prev: FlightSegment, next: FlightSegment): number | null {
  const arrivalWithTz = parseTimestampWithTimezone(prev.arrivalDateTime, prev.arrivalTimeZone)
  const departureWithTz = parseTimestampWithTimezone(next.departureDateTime, next.departureTimeZone)

  if (arrivalWithTz !== null && departureWithTz !== null)
    return departureWithTz - arrivalWithTz

  const arrivalWall = parseWallClockMs(prev.arrivalDateTime)
  const departureWall = parseWallClockMs(next.departureDateTime)

  return (arrivalWall !== null && departureWall !== null) ? departureWall - arrivalWall : null
}

function getBookingKind(booking: Booking) {
  if (booking.type === 'car' || booking.type === 'other')
    return resolveBookingKind(booking.type, booking.data.kind, booking.icon)

  return null
}

function getStart(booking: Booking): string | undefined {
  switch (booking.type) {
    case 'flight': return booking.data.segments?.[0]?.departureDateTime
    case 'hotel': return booking.data.checkInDate
    case 'train': return booking.data.departureDateTime
    case 'car': return booking.data.pickupDateTime
    case 'attraction': return booking.data.dateTime
    case 'other': return booking.data.startDateTime
  }
}

function extractActivityHotelMinutes(activity: TimelineDayActivity, hotelId: string): number | null {
  const hasHotelLink = activity.sections?.some(section => section.type === 'booking' && section.bookingId === hotelId)

  if (!hasHotelLink)
    return null

  const startTime = parseStandaloneTime(activity.startTime)

  return startTime ? timeToMinutes(startTime) : null
}

function findLinkedHotelCheckInMinutes(hotelId: string, checkInDate: string, days?: TimelineDayContext[]): number | null {
  if (!days?.length)
    return null

  const matchingDays = days.filter(day => getValidTimelineDate(day.date ?? undefined) === checkInDate)
  const candidates = matchingDays.flatMap(day =>
    (day.activities || []).flatMap((activity) => {
      const minutes = extractActivityHotelMinutes(activity, hotelId)

      return minutes !== null ? [{ title: activity.title || '', minutes }] : []
    }))

  if (candidates.length === 0)
    return null

  candidates.sort((a, b) => a.minutes - b.minutes)
  const explicitCheckIn = candidates.find(candidate => CHECK_IN_ACTIVITY_RE.test(candidate.title))

  return (explicitCheckIn ?? candidates[0]).minutes
}

function extractMinutesOnTargetDate(dateTime: string | undefined, targetDate: string): number | null {
  const date = getValidTimelineDate(dateTime)

  if (date !== targetDate)
    return null

  const time = getTimelineTime(dateTime, date)

  return time ? timeToMinutes(time) : null
}

function resolvePairCompletionMinutes(
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  targetDate: string,
  allowStartWhenEndExists = false,
): number | null {
  const endMinutes = extractMinutesOnTargetDate(endDateTime, targetDate)

  if (endMinutes !== null)
    return endMinutes

  if (!endDateTime || allowStartWhenEndExists)
    return extractMinutesOnTargetDate(startDateTime, targetDate)

  return null
}

function toSingleMinutesList(minutes: number | null): number[] {
  return minutes !== null ? [minutes] : []
}

function getOtherTransitCompletionMinutes(booking: Extract<Booking, { type: 'other' }>, targetDate: string): number[] {
  const kind = resolveBookingKind('other', booking.data.kind, booking.icon)?.value

  if (kind && NON_TRANSIT_OTHER_KINDS.has(kind))
    return []

  return toSingleMinutesList(resolvePairCompletionMinutes(booking.data.startDateTime, booking.data.endDateTime, targetDate))
}

function getBookingTransitCompletionMinutes(booking: Booking, targetDate: string): number[] {
  switch (booking.type) {
    case 'flight':
      return (booking.data.segments || [])
        .map(seg => resolvePairCompletionMinutes(seg.departureDateTime, seg.arrivalDateTime, targetDate))
        .filter((m): m is number => m !== null)
    case 'train':
      return toSingleMinutesList(resolvePairCompletionMinutes(booking.data.departureDateTime, booking.data.arrivalDateTime, targetDate))
    case 'car':
      return toSingleMinutesList(resolvePairCompletionMinutes(
        booking.data.pickupDateTime,
        booking.data.dropoffDateTime,
        targetDate,
        true,
      ))
    case 'other':
      return getOtherTransitCompletionMinutes(booking, targetDate)
    case 'hotel':
    case 'attraction':
      return []
  }
}

function resolveHotelSortMinutes(
  hotel: Extract<Booking, { type: 'hotel' }>,
  checkInDate: string | undefined,
  bookings: Booking[],
  days?: TimelineDayContext[],
): number {
  if (!checkInDate)
    return UNTITLED_TIME_SORT_MINUTES

  const explicitCheckInTime = parseStandaloneTime(hotel.data.checkInTime)

  if (explicitCheckInTime)
    return timeToMinutes(explicitCheckInTime)

  const inlineTime = getTimelineTime(hotel.data.checkInDate, checkInDate)

  if (inlineTime && inlineTime !== '00:00')
    return timeToMinutes(inlineTime)

  const linkedMinutes = findLinkedHotelCheckInMinutes(hotel.id, checkInDate, days)

  if (linkedMinutes !== null)
    return linkedMinutes

  const transitMinutes = bookings.flatMap(b => getBookingTransitCompletionMinutes(b, checkInDate))

  return transitMinutes.length > 0
    ? Math.max(DEFAULT_HOTEL_CHECK_IN_MINUTES, ...transitMinutes)
    : DEFAULT_HOTEL_CHECK_IN_MINUTES
}

function toEventPoint(bookingId: string, dateTime?: string): EventPoint | null {
  const date = getValidTimelineDate(dateTime)

  if (!date)
    return null

  const time = getTimelineTime(dateTime, date)

  return { bookingId, date, minutes: time ? timeToMinutes(time) : 0 }
}

function getBookingAnchorPoints(booking: Booking, hotelMinutesById: Map<string, number>): EventPoint[] {
  if (booking.type === 'flight') {
    return (booking.data.segments || [])
      .map(segment => toEventPoint(booking.id, segment.departureDateTime))
      .filter((point): point is EventPoint => point !== null)
  }

  if (booking.type === 'hotel') {
    const date = getValidTimelineDate(booking.data.checkInDate)

    return date
      ? [{ bookingId: booking.id, date, minutes: hotelMinutesById.get(booking.id) ?? DEFAULT_HOTEL_CHECK_IN_MINUTES }]
      : []
  }

  const point = toEventPoint(booking.id, getStart(booking))

  return point ? [point] : []
}

function hasInterveningBookingInWindow(
  flightId: string,
  prev: FlightSegment,
  next: FlightSegment,
  anchorPoints: EventPoint[],
): boolean {
  const startSource = prev.arrivalDateTime || prev.departureDateTime
  const startDate = getValidTimelineDate(startSource)
  const endDate = getValidTimelineDate(next.departureDateTime)

  if (!startDate || !endDate)
    return false

  const startTime = getTimelineTime(startSource, startDate)
  const endTime = getTimelineTime(next.departureDateTime, endDate)
  const startMinutes = startTime ? timeToMinutes(startTime) : 0
  const endMinutes = endTime ? timeToMinutes(endTime) : UNTITLED_TIME_SORT_MINUTES

  return anchorPoints.some(point =>
    point.bookingId !== flightId
    && compareDateAndMinutes(
      point.date,
      point.minutes,
      startDate,
      startMinutes,
    ) >= 0
    && compareDateAndMinutes(
      point.date,
      point.minutes,
      endDate,
      endMinutes,
    ) <= 0)
}

function shouldSplitFlightBoundary(
  flightId: string,
  prev: FlightSegment,
  next: FlightSegment,
  anchorPoints: EventPoint[],
): boolean {
  const layoverMs = getLayoverDurationMs(prev, next)

  if (layoverMs !== null && layoverMs >= LONG_LAYOVER_THRESHOLD_MS)
    return true

  const prevDepDate = getValidTimelineDate(prev.departureDateTime)
  const nextDepDate = getValidTimelineDate(next.departureDateTime)

  if (layoverMs === null && prevDepDate && nextDepDate && prevDepDate !== nextDepDate)
    return true

  return hasInterveningBookingInWindow(
    flightId,
    prev,
    next,
    anchorPoints,
  )
}

function getFlightSegmentRanges(booking: Extract<Booking, { type: 'flight' }>, anchorPoints: EventPoint[]): FlightSegmentRange[] {
  const segments = booking.data.segments || []

  if (segments.length <= 1)
    return [{ start: 0, end: Math.max(0, segments.length - 1) }]

  const ranges: FlightSegmentRange[] = []
  let rangeStart = 0

  for (let i = 0; i < segments.length - 1; i++) {
    if (shouldSplitFlightBoundary(
      booking.id,
      segments[i],
      segments[i + 1],
      anchorPoints,
    )) {
      ranges.push({ start: rangeStart, end: i })
      rangeStart = i + 1
    }
  }

  ranges.push({ start: rangeStart, end: segments.length - 1 })

  return ranges
}

function formatSegmentSublabel(bookingTitle: string, range: FlightSegmentRange, totalSegments: number): string {
  const indexPart = range.start === range.end
    ? `${range.start + 1}/${totalSegments}`
    : `${range.start + 1}–${range.end + 1}/${totalSegments}`

  return bookingTitle ? `${bookingTitle} · ${indexPart}` : `Рейс ${indexPart}`
}

function buildFlightTimelineEntries(booking: Extract<Booking, { type: 'flight' }>, originalIndex: number, anchorPoints: EventPoint[]): TimelineEntry[] {
  const segments = booking.data.segments || []
  const ranges = getFlightSegmentRanges(booking, anchorPoints)
  const isSplit = ranges.length > 1
  const icon = booking.icon || BOOKING_TYPES_CONFIG.flight.icon

  return ranges.map((range) => {
    const start = segments[range.start]?.departureDateTime
    const validDate = getValidTimelineDate(start)
    const time = getTimelineTime(start, validDate)

    return {
      id: isSplit ? `${booking.id}:seg-${range.start}-${range.end}` : booking.id,
      booking,
      segmentRange: isSplit ? range : undefined,
      date: validDate,
      time,
      sublabel: isSplit ? formatSegmentSublabel(booking.title, range, segments.length) : undefined,
      label: labels.flight,
      icon,
      sortMinutes: time ? timeToMinutes(time) : UNTITLED_TIME_SORT_MINUTES,
      sortPriority: time ? 0 : 2,
      originalIndex,
    }
  })
}

function buildHotelTimelineEntry(booking: Extract<Booking, { type: 'hotel' }>, originalIndex: number, sortMinutes: number): TimelineEntry {
  return {
    id: booking.id,
    booking,
    date: getValidTimelineDate(booking.data.checkInDate),
    time: undefined,
    label: labels.hotel,
    icon: booking.icon || BOOKING_TYPES_CONFIG.hotel.icon,
    sortMinutes,
    sortPriority: 1,
    originalIndex,
  }
}

function buildStandardTimelineEntry(booking: Booking, originalIndex: number): TimelineEntry {
  const start = getStart(booking)
  const validDate = getValidTimelineDate(start)
  const rawTime = getTimelineTime(start, validDate)
  const kind = getBookingKind(booking)

  return {
    id: booking.id,
    booking,
    date: validDate,
    time: rawTime,
    label: kind?.label || labels[booking.type],
    icon: kind?.icon || booking.icon || BOOKING_TYPES_CONFIG[booking.type].icon,
    sortMinutes: rawTime ? timeToMinutes(rawTime) : UNTITLED_TIME_SORT_MINUTES,
    sortPriority: rawTime ? 0 : 2,
    originalIndex,
  }
}

function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  if (a.date && b.date) {
    if (a.date !== b.date)
      return a.date.localeCompare(b.date)

    return (a.sortMinutes - b.sortMinutes)
      || (a.sortPriority - b.sortPriority)
      || (a.originalIndex - b.originalIndex)
  }

  if (a.date !== b.date)
    return a.date ? -1 : 1

  return a.originalIndex - b.originalIndex
}

export function getTimelineEntry(booking: Booking): TimelineEntry {
  if (booking.type === 'hotel') {
    const validDate = getValidTimelineDate(booking.data.checkInDate)

    return buildHotelTimelineEntry(booking, 0, resolveHotelSortMinutes(booking, validDate, [booking]))
  }

  return buildStandardTimelineEntry(booking, 0)
}

export function buildTimelineEntries(bookings: Booking[], options?: TimelineOptions): TimelineEntry[] {
  const hotelMinutesById = new Map<string, number>()

  for (const booking of bookings) {
    if (booking.type === 'hotel') {
      const validDate = getValidTimelineDate(booking.data.checkInDate)
      hotelMinutesById.set(booking.id, resolveHotelSortMinutes(
        booking,
        validDate,
        bookings,
        options?.days,
      ))
    }
  }

  const anchorPoints = bookings.flatMap(booking => getBookingAnchorPoints(booking, hotelMinutesById))
  const entries = bookings.flatMap((booking, originalIndex) => {
    if (booking.type === 'flight')
      return buildFlightTimelineEntries(booking, originalIndex, anchorPoints)

    if (booking.type === 'hotel') {
      const sortMinutes = hotelMinutesById.get(booking.id) ?? DEFAULT_HOTEL_CHECK_IN_MINUTES

      return [buildHotelTimelineEntry(booking, originalIndex, sortMinutes)]
    }

    return [buildStandardTimelineEntry(booking, originalIndex)]
  })

  return entries.sort(compareTimelineEntries)
}

export function groupTimelineBookings(bookings: Booking[], options?: TimelineOptions): TimelineDayGroup[] {
  const groups: TimelineDayGroup[] = []
  const sortedEntries = buildTimelineEntries(bookings, options)

  for (const entry of sortedEntries) {
    let group = groups.at(-1)

    if (!group || group.date !== entry.date) {
      const date = entry.date ? new Date(`${entry.date}T00:00:00Z`) : null
      group = {
        key: entry.date ?? 'undated',
        date: entry.date,
        label: date
          ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
          : 'Без даты',
        weekday: date ? new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(date) : '',
        entries: [],
      }
      groups.push(group)
    }

    group.entries.push(entry)
  }

  return groups
}

function getFlightEndpoints(booking: Extract<Booking, { type: 'flight' }>, range?: FlightSegmentRange): DateTimeEndpoints {
  const segments = booking.data.segments || []
  const firstSeg = segments[range?.start ?? 0]
  const lastSeg = segments[range?.end ?? Math.max(0, segments.length - 1)]

  return {
    startDateTime: firstSeg?.departureDateTime,
    startTimeZone: firstSeg?.departureTimeZone,
    endDateTime: lastSeg?.arrivalDateTime,
    endTimeZone: lastSeg?.arrivalTimeZone,
  }
}

function getEntryEndpoints(entry: TimelineEntry): DateTimeEndpoints | null {
  const { booking } = entry

  switch (booking.type) {
    case 'flight':
      return getFlightEndpoints(booking, entry.segmentRange)
    case 'train':
      return {
        startDateTime: booking.data.departureDateTime,
        startTimeZone: booking.data.departureTimeZone,
        endDateTime: booking.data.arrivalDateTime,
        endTimeZone: booking.data.arrivalTimeZone,
      }
    case 'car':
      return {
        startDateTime: booking.data.pickupDateTime,
        startTimeZone: booking.data.pickupTimeZone,
        endDateTime: booking.data.dropoffDateTime,
        endTimeZone: booking.data.dropoffTimeZone,
      }
    case 'attraction':
      return { startDateTime: booking.data.dateTime }
    case 'other':
      return {
        startDateTime: booking.data.startDateTime,
        startTimeZone: booking.data.startTimeZone,
        endDateTime: booking.data.endDateTime,
        endTimeZone: booking.data.endTimeZone,
      }
    case 'hotel':
      return null
  }
}

export function getTimelineEntryRealTimeRange(entry: TimelineEntry): { start: number, end: number } | null {
  const endpoints = getEntryEndpoints(entry)

  if (!endpoints)
    return null

  const start = parseFlexibleTimestampMs(endpoints.startDateTime, endpoints.startTimeZone)

  if (start === null)
    return null

  const end = endpoints.endDateTime
    ? (parseFlexibleTimestampMs(endpoints.endDateTime, endpoints.endTimeZone) ?? start)
    : start + 60 * 60 * 1000

  return { start, end }
}
