<script setup lang="ts">
import type { Booking, BookingSectionContent } from '~/components/04.features/trip-info/trip-sections'
import type { ActivitySectionBooking } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import AttractionCard from '~/components/04.features/trip-info/trip-sections/booking-section/ui/cards/attraction-card.vue'
import FlightCard from '~/components/04.features/trip-info/trip-sections/booking-section/ui/cards/flight-card.vue'
import HotelCard from '~/components/04.features/trip-info/trip-sections/booking-section/ui/cards/hotel-card.vue'
import TrainCard from '~/components/04.features/trip-info/trip-sections/booking-section/ui/cards/train-card.vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { TripSectionType } from '~/shared/types/models/trip'
import SelectBookingDialog from '../dialogs/select-booking-dialog.vue'

interface Props {
  section: ActivitySectionBooking
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'updateSection', value: ActivitySectionBooking): void
  (e: 'deleteSection'): void
}>()

const store = useModuleStore(['sections', 'plan'])
const router = useRouter()
const route = useRoute()
const isSelectBookingOpen = ref(false)

const bookingSection = computed(() =>
  store.sections.sections.find(s => s.type === TripSectionType.BOOKINGS),
)

const currentBooking = computed<Booking | null>(() => {
  if (!bookingSection.value)
    return null
  const content = bookingSection.value.content as BookingSectionContent | undefined
  if (!content?.bookings)
    return null
  return content.bookings.find(b => b.id === props.section.bookingId) || null
})

const cardComponents = {
  flight: FlightCard,
  hotel: HotelCard,
  train: TrainCard,
  attraction: AttractionCard,
}

function handleUpdateBooking(updatedBooking: any) {
  if (!bookingSection.value)
    return
  const content = bookingSection.value.content as BookingSectionContent
  const index = content.bookings.findIndex(b => b.id === updatedBooking.id)
  if (index !== -1) {
    const newBookings = [...content.bookings]
    newBookings[index] = updatedBooking
    store.sections.updateSection({
      ...bookingSection.value,
      content: { ...content, bookings: newBookings },
    })
  }
}

function handleBookingSelected(newBooking: Booking) {
  emit('updateSection', {
    ...props.section,
    bookingId: newBooking.id,
  })
}

function goToBookingsSection() {
  router.push({
    path: route.path,
    query: {
      ...route.query,
      section: 'bookings',
      day: undefined,
    },
  })
}
</script>

<template>
  <div class="activity-booking-section">
    <!-- Если бронирование найдено -->
    <div v-if="currentBooking" class="booking-card-container">
      <div v-if="!readonly" class="booking-link-bar">
        <div class="link-bar-left">
          <Icon icon="mdi:link-variant" class="link-icon" />
          <span class="link-text">Связано с «Бронирования»</span>
        </div>
        <div class="link-bar-actions">
          <KitTooltip text="Выбрать другое бронирование">
            <KitBtn
              variant="subtle"
              size="xs"
              icon="mdi:swap-horizontal"
              @click="isSelectBookingOpen = true"
            >
              Сменить
            </KitBtn>
          </KitTooltip>
          <KitTooltip text="Перейти в раздел бронирований">
            <KitBtn
              variant="subtle"
              size="xs"
              icon="mdi:open-in-new"
              @click="goToBookingsSection"
            >
              В раздел
            </KitBtn>
          </KitTooltip>
        </div>
      </div>

      <Component
        :is="cardComponents[currentBooking.type]"
        :booking="currentBooking as any"
        :readonly="readonly"
        :show-drag-handle="false"
        @update:booking="handleUpdateBooking"
        @delete="emit('deleteSection')"
      />
    </div>

    <!-- Если бронирование удалено или не найдено -->
    <div v-else class="booking-not-found-card">
      <div class="not-found-header">
        <div class="not-found-icon">
          <Icon icon="mdi:ticket-alert-outline" />
        </div>
        <div class="not-found-text">
          <div class="not-found-title">
            Бронирование не найдено
          </div>
          <div class="not-found-desc">
            Связанное бронирование было удалено из путешествия или перемещено.
          </div>
        </div>
      </div>

      <div v-if="!readonly" class="not-found-actions">
        <KitBtn
          variant="outlined"
          size="sm"
          icon="mdi:swap-horizontal"
          @click="isSelectBookingOpen = true"
        >
          Выбрать другое
        </KitBtn>
        <KitBtn
          variant="text"
          size="sm"
          class="delete-btn"
          icon="mdi:trash-can-outline"
          @click="emit('deleteSection')"
        >
          Удалить блок
        </KitBtn>
      </div>
    </div>

    <!-- Диалог смены / выбора бронирования -->
    <SelectBookingDialog
      v-if="isSelectBookingOpen"
      v-model:visible="isSelectBookingOpen"
      :current-booking-id="section.bookingId"
      @select="handleBookingSelected"
    />
  </div>
</template>

<style scoped lang="scss">
.activity-booking-section {
  width: 100%;
  position: relative;
}

.booking-card-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.booking-link-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 4px 10px;
  padding-right: 46px;
  background-color: var(--bg-tertiary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  font-size: 0.78rem;
  color: var(--fg-secondary-color);

  .link-bar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;

    .link-icon {
      font-size: 0.95rem;
      color: var(--fg-accent-color);
      flex-shrink: 0;
    }

    .link-text {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .link-bar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

.booking-not-found-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: rgba(var(--fg-error-color-rgb), 0.05);
  border: 1px dashed rgba(var(--fg-error-color-rgb), 0.3);
  border-radius: var(--r-m);

  .not-found-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .not-found-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: rgba(var(--fg-error-color-rgb), 0.1);
    color: var(--fg-error-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .not-found-text {
    flex: 1;
  }

  .not-found-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--fg-primary-color);
    margin-bottom: 2px;
  }

  .not-found-desc {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    line-height: 1.3;
  }

  .not-found-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
  }
}
</style>
