import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
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
 * Извлекает основную дату из бронирования для сортировки.
 * @param booking - Объект бронирования.
 * @returns Объект Date или null, если дата не найдена.
 */
function getBookingDate(booking: Booking): Date | null {
  try {
    let dateString: string | undefined

    switch (booking.type) {
      case 'flight':
        dateString = booking.data.segments?.[0]?.departureDateTime
        break
      case 'hotel':
        dateString = booking.data.checkInDate
        if (dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString))
          dateString += 'T00:00:00'
        break
      case 'train':
        dateString = booking.data.departureDateTime
        break
      case 'attraction':
        dateString = booking.data.dateTime
        break
    }

    if (!dateString)
      return null

    const date = new Date(dateString)
    // Проверяем, что дата валидна
    if (Number.isNaN(date.getTime()))
      return null

    return date
  }
  catch {
    return null
  }
}

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
      const dateA = getBookingDate(a)
      const dateB = getBookingDate(b)

      if (!dateA && !dateB)
        return 0 // оба без даты, сохраняем исходный порядок
      if (!dateA)
        return 1 // 'a' без даты, отправляем его в конец списка
      if (!dateB)
        return -1 // 'b' без даты, отправляем его в конец списка

      const isSameDay = dateA.getFullYear() === dateB.getFullYear()
        && dateA.getMonth() === dateB.getMonth()
        && dateA.getDate() === dateB.getDate()

      if (isSameDay) {
        const aHasTime = a.type !== 'hotel'
        const bHasTime = b.type !== 'hotel'

        // Если у 'a' есть время, а у 'b' нет, 'a' должно быть первым
        if (aHasTime && !bHasTime)
          return -1
        // Если у 'b' есть время, а у 'a' нет, 'b' должно быть первым
        if (!aHasTime && bHasTime)
          return 1
      }

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
  }
}
