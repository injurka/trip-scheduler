import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'

interface UseBookingSectionProps {
  section: {
    id: string
    type: 'booking'
    content: BookingSectionContent
  }
  readonly: boolean
}

/**
 * Конфигурация для различных типов бронирований.
 * Определяет метки, иконки и заголовки по умолчанию.
 */
export const BOOKING_TYPES_CONFIG = {
  flight: { label: 'Авиаперелеты', icon: 'mdi:airplane', defaultTitle: 'Новый авиабилет' },
  hotel: { label: 'Отели', icon: 'mdi:hotel', defaultTitle: 'Новый отель' },
  train: { label: 'Поезда', icon: 'mdi:train', defaultTitle: 'Новый билет на поезд' },
  attraction: { label: 'Места', icon: 'mdi:map-marker-star-outline', defaultTitle: 'Новое место' },
} as const

/**
 * Возвращает интервал времени (начало, конец) для бронирования.
 * Если конец неизвестен, он равен началу (точечное событие).
 */
function getBookingTimeRange(booking: Booking): { start: number, end: number } | null {
  try {
    let startStr: string | undefined
    let endStr: string | undefined

    switch (booking.type) {
      case 'flight':
        startStr = booking.data.segments?.[0]?.departureDateTime
        endStr = booking.data.segments?.[booking.data.segments.length - 1]?.arrivalDateTime
        break
      case 'hotel':
        if (booking.data.checkInDate)
          startStr = booking.data.checkInDate.includes('T') ? booking.data.checkInDate : `${booking.data.checkInDate}T14:00:00`
        break
      case 'train':
        startStr = booking.data.departureDateTime
        endStr = booking.data.arrivalDateTime
        break
      case 'attraction':
        startStr = booking.data.dateTime
        endStr = undefined
        break
    }

    if (!startStr)
      return null

    const startDate = new Date(startStr)
    if (Number.isNaN(startDate.getTime()))
      return null

    let endDate = startDate
    if (endStr) {
      const parsedEnd = new Date(endStr)
      if (!Number.isNaN(parsedEnd.getTime())) {
        endDate = parsedEnd
      }
    }
    else {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    }

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

/**
 * Хук для управления логикой секции бронирований.
 * @param props - Входящие параметры компонента.
 * @param emit - Функция для отправки событий.
 */
export function useBookingSection(
  props: UseBookingSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
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

  const bookingHighlightMap = computed<Record<string, HighlightStatus>>(() => {
    const map: Record<string, HighlightStatus> = {}
    const now = Date.now()

    const highlightableBookings = allBookingsSorted.value.filter((b) => {
      if (b.type === 'hotel')
        return false
      return getBookingTimeRange(b) !== null
    })

    const activeIndex = highlightableBookings.findIndex((b) => {
      const range = getBookingTimeRange(b)
      return range && now >= range.start && now <= range.end
    })

    if (activeIndex !== -1) {
      const activeBooking = highlightableBookings[activeIndex]
      map[activeBooking.id] = 'active'

      if (activeIndex + 1 < highlightableBookings.length) {
        map[highlightableBookings[activeIndex + 1].id] = 'next'
      }
    }
    else {
      const closestBooking = highlightableBookings.find((b) => {
        const range = getBookingTimeRange(b)
        return range && range.start > now
      })

      if (closestBooking) {
        map[closestBooking.id] = 'closest'
      }
    }

    return map
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

    if (type === 'train') {
      const tz = getCurrentTimeZoneOffset()
      initialData.departureTimeZone = tz
      initialData.arrivalTimeZone = tz
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
    bookingHighlightMap,
    addBooking,
    addCompletedBooking,
    deleteBooking,
    updateBooking,
    updateBookingsForGroup,
    bookingTypeConfigs: BOOKING_TYPES_CONFIG,
  }
}
