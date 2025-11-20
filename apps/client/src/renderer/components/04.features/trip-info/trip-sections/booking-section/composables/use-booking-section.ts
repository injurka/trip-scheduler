import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { useDebounceFn, useIntervalFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

interface UseBookingSectionProps {
  section: {
    id: string
    type: 'booking'
    content: BookingSectionContent
  }
  readonly: boolean
}

export type BookingStatus = 'active' | 'soon' | 'future' | 'past'

export const BOOKING_TYPES_CONFIG = {
  flight: { label: 'Авиаперелеты', icon: 'mdi:airplane', defaultTitle: 'Новый авиабилет' },
  hotel: { label: 'Отели', icon: 'mdi:hotel', defaultTitle: 'Новый отель' },
  train: { label: 'Поезда', icon: 'mdi:train', defaultTitle: 'Новый билет на поезд' },
  attraction: { label: 'Места', icon: 'mdi:map-marker-star-outline', defaultTitle: 'Новое место' },
} as const

/**
 * Парсит дату из строки, учитывая возможные форматы и часовые пояса.
 * Возвращает timestamp.
 */
function parseDateSafely(dateStr?: string, timeZone?: string): number | null {
  if (!dateStr)
    return null
  try {
    // Если есть timezone, добавляем его к строке
    const fullStr = timeZone ? `${dateStr}${timeZone}` : dateStr
    const date = new Date(fullStr)
    if (Number.isNaN(date.getTime()))
      return null
    return date.getTime()
  }
  catch {
    return null
  }
}

/**
 * Получает начало и конец времени для бронирования.
 */
function getBookingTimeRange(booking: Booking): { start: number | null, end: number | null } {
  let start: number | null = null
  let end: number | null = null

  switch (booking.type) {
    case 'flight': {
      const segments = booking.data.segments || []
      if (segments.length > 0) {
        start = parseDateSafely(segments[0].departureDateTime, segments[0].departureTimeZone)
        const last = segments[segments.length - 1]
        end = parseDateSafely(last.arrivalDateTime, last.arrivalTimeZone)
      }
      break
    }
    case 'train': {
      start = parseDateSafely(booking.data.departureDateTime, booking.data.departureTimeZone)
      end = parseDateSafely(booking.data.arrivalDateTime, booking.data.arrivalTimeZone)
      break
    }
    case 'hotel': {
      // Для отелей считаем началом 14:00 дня заезда, концом 12:00 дня выезда
      // Или просто весь день, если время не указано.
      // Для упрощения: берем даты как есть (UTC midnight)
      const checkIn = parseDateSafely(booking.data.checkInDate)
      const checkOut = parseDateSafely(booking.data.checkOutDate)
      if (checkIn)
        start = checkIn + 14 * 60 * 60 * 1000 // 14:00
      if (checkOut)
        end = checkOut + 12 * 60 * 60 * 1000 // 12:00
      break
    }
    case 'attraction': {
      start = parseDateSafely(booking.data.dateTime)
      if (start)
        end = start + 3 * 60 * 60 * 1000 // Предполагаем длительность 3 часа
      break
    }
  }

  return { start, end }
}

function getBookingDate(booking: Booking): Date | null {
  const { start } = getBookingTimeRange(booking)
  return start ? new Date(start) : null
}

export function useBookingSection(
  props: UseBookingSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
  const bookings = ref<Booking[]>(JSON.parse(JSON.stringify(props.section.content?.bookings || [])))
  const activeTab = ref<string>('timeline')
  const now = ref(Date.now())

  // Обновляем текущее время каждую минуту для актуализации статусов
  useIntervalFn(() => {
    now.value = Date.now()
  }, 60 * 1000)

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: { bookings: bookings.value },
    })
  }, 700)

  const bookingStatuses = computed(() => {
    const statuses: Record<string, BookingStatus> = {}
    const upcomingBookings: { id: string, timeToStart: number }[] = []

    bookings.value.forEach((booking) => {
      const { start, end } = getBookingTimeRange(booking)

      if (!start) {
        statuses[booking.id] = 'future'
        return
      }

      const safeEnd = end || start + 60 * 60 * 1000 // Fallback end time

      if (now.value >= start && now.value <= safeEnd) {
        statuses[booking.id] = 'active'
      }
      else if (now.value > safeEnd) {
        statuses[booking.id] = 'past'
      }
      else {
        // Future
        statuses[booking.id] = 'future'
        const timeToStart = start - now.value
        // Если до начала менее 24 часов
        if (timeToStart <= 24 * 60 * 60 * 1000) {
          upcomingBookings.push({ id: booking.id, timeToStart })
        }
      }
    })

    // Находим ОДНО ближайшее предстоящее бронирование
    if (upcomingBookings.length > 0) {
      upcomingBookings.sort((a, b) => a.timeToStart - b.timeToStart)
      const nearestId = upcomingBookings[0].id
      statuses[nearestId] = 'soon'
    }

    return statuses
  })

  const getBookingStatus = (id: string): BookingStatus => {
    return bookingStatuses.value[id] || 'future'
  }

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
      const dateA = getBookingDate(a)
      const dateB = getBookingDate(b)

      if (!dateA && !dateB)
        return 0
      if (!dateA)
        return 1
      if (!dateB)
        return -1

      return dateA.getTime() - dateB.getTime()
    })
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
    const newBooking: Booking = {
      id: uuidv4(),
      type,
      icon: config.icon,
      title: config.defaultTitle,
      data: {},
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
    addBooking,
    addCompletedBooking,
    deleteBooking,
    updateBooking,
    updateBookingsForGroup,
    bookingTypeConfigs: BOOKING_TYPES_CONFIG,
    getBookingStatus,
  }
}
