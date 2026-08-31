<script setup lang="ts">
import type { Booking, BookingSectionContent, BookingType } from '~/components/04.features/trip-info/trip-sections/booking-section'
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { BOOKING_TYPES_CONFIG } from '~/components/04.features/trip-info/trip-sections/booking-section'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { TripSectionType } from '~/shared/types/models/trip'

interface Props {
  visible: boolean
  currentBookingId?: string
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', booking: Booking): void
}>()

const store = useModuleStore(['sections', 'plan'])
const searchQuery = ref('')
const selectedTypeTab = ref<string>('all')

const allBookings = computed<Booking[]>(() => {
  const bookingSection = store.sections.sections.find(s => s.type === TripSectionType.BOOKINGS)
  if (!bookingSection)
    return []
  const content = bookingSection.content as BookingSectionContent | undefined
  return content?.bookings || []
})

const currentDayDateStr = computed(() => {
  const day = store.plan.getSelectedDay
  if (!day?.date)
    return null
  return day.date.split('T')[0]
})

function isBookingMatchingDay(booking: Booking, dateStr: string | null): boolean {
  if (!dateStr)
    return false
  const selectedDate = new Date(dateStr)

  switch (booking.type) {
    case 'flight':
      return !!booking.data.segments?.some(s => s.departureDateTime?.startsWith(dateStr))
    case 'hotel': {
      if (!booking.data.checkInDate || !booking.data.checkOutDate)
        return false
      const checkIn = new Date(booking.data.checkInDate.split('T')[0])
      const checkOut = new Date(booking.data.checkOutDate.split('T')[0])
      return selectedDate >= checkIn && selectedDate < checkOut
    }
    case 'train':
      return !!booking.data.departureDateTime?.startsWith(dateStr)
    case 'car': {
      if (!booking.data.pickupDateTime)
        return false
      if (booking.data.dropoffDateTime) {
        const pickup = new Date(booking.data.pickupDateTime.split('T')[0])
        const dropoff = new Date(booking.data.dropoffDateTime.split('T')[0])
        return selectedDate >= pickup && selectedDate <= dropoff
      }
      return booking.data.pickupDateTime.startsWith(dateStr)
    }
    case 'attraction':
      return !!booking.data.dateTime?.startsWith(dateStr)
    default:
      return false
  }
}

function getBookingSummary(booking: Booking): { title: string, subtitle: string, dateInfo: string } {
  switch (booking.type) {
    case 'flight': {
      const segs = booking.data.segments || []
      const first = segs[0]
      const last = segs[segs.length - 1]
      const route = first && last
        ? `${first.departureCity || first.departureAirport || '—'} → ${last.arrivalCity || last.arrivalAirport || '—'}`
        : 'Маршрут не указан'
      const flightNum = first?.flightNumber ? `Рейс ${first.flightNumber}` : (first?.airline || 'Авиаперелет')
      const date = first?.departureDateTime ? new Date(first.departureDateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
      return { title: booking.title || flightNum, subtitle: route, dateInfo: date }
    }
    case 'hotel': {
      const dates = booking.data.checkInDate && booking.data.checkOutDate
        ? `${new Date(booking.data.checkInDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${new Date(booking.data.checkOutDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
        : (booking.data.checkInDate || '')
      return {
        title: booking.title || booking.data.hotelName || 'Отель',
        subtitle: booking.data.address || booking.data.hotelName || 'Адрес не указан',
        dateInfo: dates,
      }
    }
    case 'train': {
      const route = booking.data.departureStation && booking.data.arrivalStation
        ? `${booking.data.departureStation} → ${booking.data.arrivalStation}`
        : 'Маршрут не указан'
      const date = booking.data.departureDateTime
        ? new Date(booking.data.departureDateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : ''
      return {
        title: booking.title || (booking.data.trainNumber ? `Поезд ${booking.data.trainNumber}` : 'Поезд'),
        subtitle: route,
        dateInfo: date,
      }
    }
    case 'car': {
      const route = booking.data.pickupLocation && booking.data.dropoffLocation
        ? `${booking.data.pickupLocation} → ${booking.data.dropoffLocation}`
        : (booking.data.pickupLocation || 'Адрес не указан')
      const title = booking.title || booking.data.carModel || booking.data.company || 'Автомобиль'
      const date = booking.data.pickupDateTime
        ? new Date(booking.data.pickupDateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : ''
      return {
        title,
        subtitle: route,
        dateInfo: date,
      }
    }
    case 'attraction': {
      const date = booking.data.dateTime
        ? new Date(booking.data.dateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : ''
      return {
        title: booking.title || booking.data.attractionName || 'Место',
        subtitle: booking.data.address || 'Адрес не указан',
        dateInfo: date,
      }
    }
  }
}

const typeTabs = computed(() => {
  const tabs = [{ id: 'all', label: 'Все', icon: 'mdi:view-grid-outline' }]
  const counts: Record<string, number> = {}

  for (const b of allBookings.value) {
    counts[b.type] = (counts[b.type] || 0) + 1
  }

  const configs = BOOKING_TYPES_CONFIG as Record<BookingType, { label: string, icon: string, defaultTitle: string }>
  for (const type of Object.keys(configs) as BookingType[]) {
    const config = configs[type]
    const count = counts[type] || 0
    if (count > 0) {
      tabs.push({
        id: type,
        label: `${config.label} (${count})`,
        icon: config.icon,
      })
    }
  }

  return tabs
})

const filteredBookings = computed(() => {
  let list = allBookings.value

  if (selectedTypeTab.value !== 'all') {
    list = list.filter(b => b.type === selectedTypeTab.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter((b) => {
      const summary = getBookingSummary(b)
      return b.title.toLowerCase().includes(q)
        || summary.subtitle.toLowerCase().includes(q)
        || summary.title.toLowerCase().includes(q)
        || JSON.stringify(b.data).toLowerCase().includes(q)
    })
  }

  // Sort: matching day first, then by title
  return [...list].sort((a, b) => {
    const aMatch = isBookingMatchingDay(a, currentDayDateStr.value)
    const bMatch = isBookingMatchingDay(b, currentDayDateStr.value)
    if (aMatch && !bMatch)
      return -1
    if (!aMatch && bMatch)
      return 1
    return 0
  })
})

function selectBooking(booking: Booking) {
  emit('select', booking)
  emit('update:visible', false)
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Привязать бронирование"
    icon="mdi:ticket-confirmation-outline"
    :max-width="700"
    @update:visible="handleClose"
  >
    <div class="select-booking-content">
      <div v-if="allBookings.length > 0" class="filter-controls">
        <KitInput
          v-model="searchQuery"
          placeholder="Поиск бронирования (отель, рейс, город...)"
          icon="mdi:magnify"
          size="sm"
          class="search-input"
        />

        <KitViewSwitcher
          v-if="typeTabs.length > 2"
          v-model="selectedTypeTab"
          :items="typeTabs"
          full-width
          class="category-tabs"
        />
      </div>

      <div v-if="allBookings.length === 0" class="empty-state">
        <Icon icon="mdi:ticket-outline" class="empty-icon" />
        <div class="empty-title">
          В путешествии пока нет бронирований
        </div>
        <p class="empty-desc">
          Добавьте билеты, отели или мероприятия в разделе «Бронирования», чтобы привязать их к активности.
        </p>
      </div>

      <div v-else-if="filteredBookings.length === 0" class="empty-state">
        <Icon icon="mdi:file-search-outline" class="empty-icon" />
        <div class="empty-title">
          Ничего не найдено
        </div>
        <p class="empty-desc">
          Попробуйте изменить поисковый запрос или фильтр категорий.
        </p>
      </div>

      <div v-else class="bookings-list">
        <div
          v-for="booking in filteredBookings"
          :key="booking.id"
          class="booking-item"
          :class="{
            'is-selected': currentBookingId === booking.id,
            'is-day-matched': isBookingMatchingDay(booking, currentDayDateStr),
          }"
          @click="selectBooking(booking)"
        >
          <div class="booking-type-icon" :class="`type-${booking.type}`">
            <Icon :icon="BOOKING_TYPES_CONFIG[booking.type as BookingType]?.icon || 'mdi:ticket-outline'" />
          </div>

          <div class="booking-info">
            <div class="booking-header">
              <span class="booking-title">{{ getBookingSummary(booking).title }}</span>
              <span v-if="isBookingMatchingDay(booking, currentDayDateStr)" class="day-match-badge">
                <Icon icon="mdi:calendar-check" />
                Этот день
              </span>
            </div>
            <div class="booking-subtitle">
              {{ getBookingSummary(booking).subtitle }}
            </div>
            <div v-if="getBookingSummary(booking).dateInfo" class="booking-date">
              <Icon icon="mdi:clock-outline" />
              <span>{{ getBookingSummary(booking).dateInfo }}</span>
            </div>
          </div>

          <div v-if="currentBookingId === booking.id" class="booking-selected-indicator">
            <Icon icon="mdi:check-circle" />
          </div>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.select-booking-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.filter-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  width: 100%;
}

.category-tabs {
  margin-top: -4px;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 3px;
  }
}

.booking-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
    box-shadow: var(--s-s);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--fg-accent-color-rgb), 0.08);
  }

  &.is-day-matched:not(.is-selected) {
    border-color: rgba(var(--fg-accent-color-rgb), 0.4);
  }
}

.booking-type-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-accent-color);

  &.type-flight {
    background-color: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }
  &.type-hotel {
    background-color: rgba(168, 85, 247, 0.12);
    color: #a855f7;
  }
  &.type-train {
    background-color: rgba(249, 115, 22, 0.12);
    color: #f97316;
  }
  &.type-attraction {
    background-color: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }
}

.booking-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.booking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.booking-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
}

.day-match-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background-color: rgba(var(--fg-accent-color-rgb), 0.15);
  color: var(--fg-accent-color);
}

.booking-subtitle {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.booking-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
  margin-top: 2px;
}

.booking-selected-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
  padding: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  color: var(--fg-secondary-color);

  .empty-icon {
    font-size: 48px;
    color: var(--fg-tertiary-color);
    margin-bottom: 12px;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin-bottom: 6px;
  }

  .empty-desc {
    font-size: 0.88rem;
    max-width: 380px;
    margin: 0;
    line-height: 1.4;
  }
}
</style>
