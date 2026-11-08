import type { HighlightStatus } from '../lib/booking-highlights'
import type { TimelineDayContext } from '../lib/booking-timeline'
import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { useCurrentTime } from '~/shared/composables/use-current-time'
import { BOOKING_TYPES_CONFIG } from '../constants/booking-types'
import { buildRangeHighlightMap } from '../lib/booking-highlights'
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

export type { HighlightStatus } from '../lib/booking-highlights'

/**
 * Хук для управления логикой секции бронирований.
 * @param props - Входящие параметры компонента.
 * @param emit - Функция для отправки событий.
 */
export function useBookingSection(props: UseBookingSectionProps, emit: (event: 'updateSection', payload: UseBookingSectionProps['section']) => void) {
  const bookings = ref<Booking[]>(JSON.parse(JSON.stringify(props.section.content?.bookings || [])))
  const activeTab = ref<string>('timeline')
  const now = useCurrentTime()
  let sourceSectionId = props.section.id
  let sourceSnapshot = JSON.stringify(props.section.content?.bookings || [])
  let publishedSnapshot: string | undefined

  const debouncedUpdate = useDebounceFn(() => {
    if (props.readonly || JSON.stringify(bookings.value) === JSON.stringify(props.section.content?.bookings || []))
      return

    publishedSnapshot = JSON.stringify(bookings.value)
    emit('updateSection', {
      ...props.section,
      content: { bookings: JSON.parse(JSON.stringify(bookings.value)) },
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

  const timelineEntries = computed(() => buildTimelineEntries(bookings.value, { days: props.days }))
  const timelineGroups = computed(() => groupTimelineBookings(bookings.value, { days: props.days }))
  const timelineHighlightMap = computed(() => buildRangeHighlightMap(
    timelineEntries.value,
    entry => entry.id,
    getTimelineEntryRealTimeRange,
    now.value.getTime(),
  ))
  const bookingHighlightMap = computed(() => {
    const map: Record<string, HighlightStatus> = {}

    for (const entry of timelineEntries.value) {
      const status = timelineHighlightMap.value[entry.id]

      if (status && map[entry.booking.id] !== 'active')
        map[entry.booking.id] = status
    }

    return map
  })
  const activeTimelineEntries = computed(() => timelineEntries.value.filter(entry => timelineHighlightMap.value[entry.id] === 'active'))
  const nextTimelineEntry = computed(() => timelineEntries.value.find(entry => timelineHighlightMap.value[entry.id] === 'next'))

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

    const initialData: Partial<import('../models/types').TrainData & import('../models/types').CarData & import('../models/types').OtherData> = {}

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

  watch(() => [props.section.id, props.section.content?.bookings], () => {
    const incoming = props.section.content?.bookings || []
    const snapshot = JSON.stringify(incoming)
    const sameSection = props.section.id === sourceSectionId

    if (sameSection && snapshot === sourceSnapshot)
      return

    sourceSectionId = props.section.id
    sourceSnapshot = snapshot

    // Подтверждение предыдущего сохранения не должно стирать уже набранные новые правки.
    if (sameSection && snapshot === publishedSnapshot)
      return

    publishedSnapshot = undefined

    if (snapshot !== JSON.stringify(bookings.value))
      bookings.value = JSON.parse(snapshot)
  }, { deep: true })

  watch(bookings, () => {
    debouncedUpdate()
  }, { deep: true })

  return {
    bookings,
    activeTab,
    bookingGroups,
    tabItems,
    activeTimelineEntries,
    nextTimelineEntry,
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
