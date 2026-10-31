import type { TimelineDayContext } from '../lib/booking-timeline'
import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { BOOKING_TYPES_CONFIG } from '../constants/booking-types'
import { buildTimelineEntries, getTimelineEntryRealTimeRange, groupTimelineBookings } from '../lib/booking-timeline'

export { BOOKING_TYPES_CONFIG }

interface UseBookingSectionProps {
  section: {
    id: string
    type: 'booking'
    content: BookingSectionContent
  }
  days?: TimelineDayContext[]
  readonly: boolean
}

interface BookingDateStrings {
  start?: string
  end?: string
}

function normalizeHotelCheckIn(checkInDate?: string, checkInTime?: string): string | undefined {
  if (!checkInDate)
    return undefined

  const datePart = checkInDate.split('T')[0]

  if (checkInTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(checkInTime.trim()))
    return `${datePart}T${checkInTime.trim()}:00`

  if (checkInDate.includes('T') && !checkInDate.includes('T00:00'))
    return checkInDate

  return `${datePart}T15:00:00`
}

function getBookingDateStrings(booking: Booking): BookingDateStrings {
  switch (booking.type) {
    case 'flight':
      return getFlightBookingDateStrings(booking)
    case 'hotel':
      return { start: normalizeHotelCheckIn(booking.data.checkInDate, booking.data.checkInTime) }
    case 'train':
      return { start: booking.data.departureDateTime, end: booking.data.arrivalDateTime }
    case 'car':
      return { start: booking.data.pickupDateTime, end: booking.data.dropoffDateTime }
    case 'attraction':
      return { start: booking.data.dateTime }
    case 'other':
      return { start: booking.data.startDateTime, end: booking.data.endDateTime }
  }
}

function getFlightBookingDateStrings(booking: Extract<Booking, { type: 'flight' }>): BookingDateStrings {
  const segments = booking.data.segments

  return {
    start: segments?.[0]?.departureDateTime,
    end: segments?.[segments.length - 1]?.arrivalDateTime,
  }
}

function parseBookingDate(value?: string): Date | null {
  if (!value)
    return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function getBookingEndDate(startDate: Date, endValue?: string): Date {
  if (!endValue)
    return new Date(startDate.getTime() + 60 * 60 * 1000)

  const parsedEndDate = parseBookingDate(endValue)

  return parsedEndDate ?? startDate
}

/**
 * Возвращает интервал времени (начало, конец) для бронирования.
 * Если конец неизвестен, он равен началу (точечное событие).
 */
function getBookingTimeRange(booking: Booking): { start: number, end: number } | null {
  try {
    const { start: startValue, end: endValue } = getBookingDateStrings(booking)
    const startDate = parseBookingDate(startValue)

    if (!startDate)
      return null

    const endDate = getBookingEndDate(startDate, endValue)

    return { start: startDate.getTime(), end: endDate.getTime() }
  }
  catch {
    return null
  }
}

/**
 * Получает текущее смещение часового пояса в формате ISO (например, +03:00)
 */
function getCurrentTimeZoneOffset(): string {
  const offsetMinutes = new Date().getTimezoneOffset()
  const sign = offsetMinutes <= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  const minutes = String(abs % 60).padStart(2, '0')

  return `${sign}${hours}:${minutes}`
}

export type HighlightStatus = 'active' | 'next' | 'closest' | null

function buildRangeHighlightMap<T>(items: T[], getId: (item: T) => string, getRange: (item: T) => { start: number, end: number } | null): Record<string, HighlightStatus> {
  const map: Record<string, HighlightStatus> = {}
  const now = Date.now()

  const highlightable = items
    .map(item => ({ id: getId(item), range: getRange(item) }))
    .filter((entry): entry is { id: string, range: { start: number, end: number } } => entry.range !== null)

  const activeIndex = highlightable.findIndex(({ range }) => now >= range.start && now <= range.end)

  if (activeIndex !== -1) {
    map[highlightable[activeIndex].id] = 'active'

    if (activeIndex + 1 < highlightable.length)
      map[highlightable[activeIndex + 1].id] = 'next'
  }
  else {
    const closest = highlightable.find(({ range }) => range.start > now)

    if (closest)
      map[closest.id] = 'closest'
  }

  return map
}

/**
 * Хук для управления логикой секции бронирований.
 * @param props - Входящие параметры компонента.
 * @param emit - Функция для отправки событий.
 */
export function useBookingSection(props: UseBookingSectionProps, emit: (event: 'updateSection', payload: any) => void) {
  const bookings = ref<Booking[]>(JSON.parse(JSON.stringify(props.section.content?.bookings || [])))
  const activeTab = ref<string>('timeline')

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: { bookings: bookings.value },
    })
  }, 700)

  const bookingGroups = computed(() => {
    return bookings.value.reduce((acc, booking) => {
      if (!acc[booking.type])
        acc[booking.type] = []

      acc[booking.type].push(booking)

      return acc
    }, {} as Record<string, Booking[]>)
  })

  const allBookingsSorted = computed(() => {
    return [...bookings.value].sort((a, b) => {
      const rangeA = getBookingTimeRange(a)
      const rangeB = getBookingTimeRange(b)

      if (!rangeA && !rangeB)
        return 0

      if (!rangeA)
        return 1

      if (!rangeB)
        return -1

      return rangeA.start - rangeB.start
    })
  })

  const timelineEntries = computed(() => buildTimelineEntries(bookings.value, { days: props.days }))
  const timelineGroups = computed(() => groupTimelineBookings(bookings.value, { days: props.days }))

  const bookingHighlightMap = computed<Record<string, HighlightStatus>>(() => {
    const nonHotelBookings = allBookingsSorted.value.filter(b => b.type !== 'hotel')

    return buildRangeHighlightMap(nonHotelBookings, b => b.id, getBookingTimeRange)
  })

  const timelineHighlightMap = computed<Record<string, HighlightStatus>>(() => {
    return buildRangeHighlightMap(timelineEntries.value, entry => entry.id, getTimelineEntryRealTimeRange)
  })

  const tabItems = computed(() => {
    const bookingOrder = Object.keys(BOOKING_TYPES_CONFIG)
    const typeTabs = Object.keys(bookingGroups.value)
      .filter(type => bookingGroups.value[type].length > 0)
      .map(type => ({
        id: type,
        label: BOOKING_TYPES_CONFIG[type as BookingType]?.label || type,
        icon: BOOKING_TYPES_CONFIG[type as BookingType]?.icon || 'mdi:help-circle',
      }))
      .sort((a, b) => bookingOrder.indexOf(a.id) - bookingOrder.indexOf(b.id))

    if (bookings.value.length > 0) {
      const timelineTab = { id: 'timeline', label: 'Лента', icon: 'mdi:timeline-outline' }

      return [timelineTab, ...typeTabs]
    }

    return []
  })

  watch(tabItems, (newTabs) => {
    const currentTabExists = newTabs.some(tab => tab.id === activeTab.value)

    if (!currentTabExists && newTabs.length > 0) {
      activeTab.value = newTabs[0].id
    }
    else if (newTabs.length === 0) {
      activeTab.value = 'timeline'
    }
  }, { immediate: true })

  function addBooking(type: BookingType) {
    if (props.readonly)
      return

    const config = BOOKING_TYPES_CONFIG[type]

    const initialData: any = {}

    if (type === 'train' || type === 'car' || type === 'other') {
      const tz = getCurrentTimeZoneOffset()

      if (type === 'other') {
        initialData.startTimeZone = tz
        initialData.endTimeZone = tz
      }
      else if (type === 'train') {
        initialData.departureTimeZone = tz
        initialData.arrivalTimeZone = tz
      }
      else {
        initialData.pickupTimeZone = tz
        initialData.dropoffTimeZone = tz
      }
    }

    const newBooking: Booking = {
      id: uuidv4(),
      type,
      icon: config.icon,
      title: config.defaultTitle,
      data: initialData,
    } as Booking

    bookings.value.unshift(newBooking)
    activeTab.value = type
  }

  function addCompletedBooking(booking: Omit<Booking, 'id'>) {
    if (props.readonly)
      return

    const newBookingWithId: Booking = {
      ...booking,
      id: uuidv4(),
    } as Booking

    bookings.value.unshift(newBookingWithId)
    activeTab.value = newBookingWithId.type
  }

  function deleteBooking(id: string) {
    if (props.readonly)
      return

    bookings.value = bookings.value.filter(b => b.id !== id)
  }

  function updateBooking(updatedBooking: Booking) {
    const index = bookings.value.findIndex(b => b.id === updatedBooking.id)

    if (index !== -1) {
      bookings.value.splice(index, 1, updatedBooking)
    }
  }

  function updateBookingsForGroup(group: string, newBookings: Booking[]) {
    const otherBookings = bookings.value.filter(b => b.type !== group)
    bookings.value = [...otherBookings, ...newBookings]
  }

  watch(bookings, () => {
    debouncedUpdate()
  }, { deep: true })

  return {
    bookings,
    activeTab,
    bookingGroups,
    tabItems,
    allBookingsSorted,
    timelineEntries,
    timelineGroups,
    bookingHighlightMap,
    timelineHighlightMap,
    addBooking,
    addCompletedBooking,
    deleteBooking,
    updateBooking,
    updateBookingsForGroup,
    bookingTypeConfigs: BOOKING_TYPES_CONFIG,
  }
}
