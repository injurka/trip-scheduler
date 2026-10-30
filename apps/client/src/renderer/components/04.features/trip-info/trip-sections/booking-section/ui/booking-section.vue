<script setup lang="ts">
import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useBookingSection } from '../composables'
import { groupTimelineBookings } from '../lib/booking-timeline'
import AttractionCard from './cards/attraction-card.vue'
import CarCard from './cards/car-card.vue'
import FlightCard from './cards/flight-card.vue'
import HotelCard from './cards/hotel-card.vue'
import OtherCard from './cards/other-card.vue'
import TrainCard from './cards/train-card.vue'
import AddBookingDialog from './dialogs/add-booking-dialog.vue'
import AiBookingCreator from './shared/ai-booking-creator.vue'

interface Props {
  section: {
    id: string
    type: 'booking'
    content: BookingSectionContent
  }
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'updateSection', value: { id: string, type: 'booking', content: BookingSectionContent }): void
}>()

const {
  activeTab,
  bookingGroups,
  tabItems,
  allBookingsSorted,
  bookingHighlightMap,
  addBooking,
  addCompletedBooking,
  deleteBooking,
  bookings,
  updateBooking,
  updateBookingsForGroup,
  bookingTypeConfigs,
} = useBookingSection(props, emit)

const isAiCreatorViewOpen = ref(false)
const isAddDialogOpen = ref(false)
const cardComponents = {
  flight: FlightCard,
  hotel: HotelCard,
  train: TrainCard,
  car: CarCard,
  attraction: AttractionCard,
  other: OtherCard,
}

const timelineGroups = computed(() => groupTimelineBookings(allBookingsSorted.value))

function onAiSave(booking: Omit<Booking, 'id'>) {
  addCompletedBooking(booking)
  isAiCreatorViewOpen.value = false
}
function handleAddBooking(type: BookingType) {
  addBooking(type)
  isAddDialogOpen.value = false
}
function getCardComponent(type: Booking['type']) {
  return cardComponents[type]
}
</script>

<template>
  <div class="booking-section">
    <div v-if="!readonly" class="actions-panel">
      <KitBtn
        icon="mdi:plus-circle-outline"
        variant="subtle"
        @click="isAddDialogOpen = true"
      >
        Добавить бронирование
      </KitBtn>
      <KitBtn
        icon="mdi:auto-fix"
        variant="tonal"
        title="Создать с помощью ИИ"
        @click="isAiCreatorViewOpen = !isAiCreatorViewOpen"
      >
        AI
      </KitBtn>
    </div>

    <div v-show="isAiCreatorViewOpen" v-if="!readonly" class="ai-creator-wrapper">
      <AiBookingCreator @save="onAiSave" @close="isAiCreatorViewOpen = false" />
    </div>

    <div v-if="bookings.length > 0 && tabItems.length > 0" class="tabs-container">
      <KitTabs v-model="activeTab" :items="tabItems">
        <template #timeline>
          <div class="bookings-timeline">
            <section
              v-for="group in timelineGroups"
              :key="group.key"
              class="timeline-day"
              :aria-label="group.label"
            >
              <header class="timeline-date">
                <span class="timeline-date-marker"><Icon :icon="group.date ? 'mdi:calendar-outline' : 'mdi:calendar-question'" /></span>
                <div class="timeline-date-text">
                  <time v-if="group.date" :datetime="group.date">{{ group.label }}</time>
                  <span v-else>{{ group.label }}</span>
                  <span v-if="group.weekday" class="timeline-weekday">{{ group.weekday }}</span>
                </div>
                <span class="timeline-count">{{ group.entries.length }}</span>
              </header>
              <ol class="bookings-grid timeline-items">
                <li
                  v-for="entry in group.entries"
                  :key="entry.booking.id"
                  class="timeline-item"
                  :class="[`timeline-tone-${entry.booking.type}`, { 'is-highlighted': bookingHighlightMap[entry.booking.id] }]"
                >
                  <div class="timeline-marker" aria-hidden="true">
                    <Icon :icon="entry.icon" />
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-meta">
                      <span class="timeline-type">{{ entry.label }}</span>
                      <time v-if="entry.time" :datetime="`${entry.date}T${entry.time}`">{{ entry.time }}</time>
                      <span v-else-if="entry.booking.type === 'hotel' && entry.date">Заезд</span>
                      <span v-else-if="entry.date">Время не указано</span>
                    </div>
                    <Component
                      :is="getCardComponent(entry.booking.type)"
                      :booking="entry.booking as any"
                      :readonly="readonly"
                      :show-drag-handle="false"
                      :highlight-status="bookingHighlightMap[entry.booking.id]"
                      @delete="deleteBooking(entry.booking.id)"
                      @update:booking="updateBooking"
                    />
                  </div>
                </li>
              </ol>
            </section>
          </div>
        </template>

        <template v-for="tab in tabItems.filter(t => t.id !== 'timeline')" :key="tab.id" #[tab.id]>
          <draggable
            :model-value="bookingGroups[tab.id] || []"
            item-key="id"
            handle=".drag-handle"
            ghost-class="ghost-item"
            :disabled="readonly"
            class="bookings-grid"
            @update:model-value="updateBookingsForGroup(tab.id, $event)"
          >
            <template #item="{ element: booking }">
              <component
                :is="getCardComponent(booking.type)"
                :booking="booking"
                :readonly="readonly"
                :highlight-status="bookingHighlightMap[booking.id]"
                @delete="deleteBooking(booking.id)"
                @update:booking="updateBooking"
              />
            </template>
          </draggable>
        </template>
      </KitTabs>
    </div>

    <div v-else-if="!isAiCreatorViewOpen" class="empty-state">
      <Icon icon="mdi:ticket-confirmation-outline" class="empty-icon" />
      <p>Пока нет ни одного бронирования.</p>
      <p v-if="!readonly">
        Нажмите на кнопку выше, чтобы добавить информацию.
      </p>
    </div>

    <AddBookingDialog
      v-if="!readonly"
      v-model:visible="isAddDialogOpen"
      :booking-type-configs="bookingTypeConfigs"
      @add="handleAddBooking"
    />
  </div>
</template>

<style scoped lang="scss">
.booking-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1rem;
  z-index: 6;
}

.tabs-container {
  min-width: 0;
}

.actions-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.ai-creator-wrapper {
  margin-top: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
}

.bookings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;

  > * {
    min-width: 0;
  }
}

.ghost-item {
  opacity: 0.5;
  background: var(--bg-accent-color);
  border-radius: var(--r-m);
}

.bookings-timeline {
  --timeline-rail-width: 2.5rem;
  --timeline-gap: 1rem;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
}

.timeline-day {
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 1.25rem;
    bottom: 0;
    left: calc(var(--timeline-rail-width) / 2 - 1px);
    width: 2px;
    background: var(--border-secondary-color);
  }

  &:last-child::before {
    bottom: 2rem;
  }
}

.timeline-date {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--timeline-gap);
  padding-bottom: 1rem;
}

.timeline-date-marker,
.timeline-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--timeline-rail-width);
  height: var(--timeline-rail-width);
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 1.1rem;
}

.timeline-date-marker {
  color: var(--fg-secondary-color);
}

.timeline-date-text {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 0.75rem;
  row-gap: 0.15rem;
  min-width: 0;
  font-size: 1rem;
  font-weight: 650;
  color: var(--fg-primary-color);
}

.timeline-weekday {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--fg-tertiary-color);
}

.timeline-count {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  padding: 0.1rem 0.45rem;
}

.timeline-items {
  position: relative;
  list-style: none;
  padding: 0 0 1.75rem;
  margin: 0;
  gap: 1.25rem;
}

.timeline-item {
  display: grid;
  grid-template-columns: var(--timeline-rail-width) minmax(0, 1fr);
  gap: var(--timeline-gap);
  --timeline-tone: var(--fg-secondary-color);

  &.timeline-tone-flight {
    --timeline-tone: var(--fg-info-color);
  }
  &.timeline-tone-hotel {
    --timeline-tone: var(--fg-success-color);
  }
  &.timeline-tone-train {
    --timeline-tone: var(--fg-accent-color);
  }
  &.timeline-tone-car {
    --timeline-tone: var(--fg-warning-color);
  }
  &.timeline-tone-attraction {
    --timeline-tone: var(--fg-accent-color);
  }

  &.is-highlighted .timeline-marker {
    border-color: var(--timeline-tone);
  }
}

.timeline-marker {
  margin-top: 1.75rem;
  color: var(--timeline-tone);
  background: var(--bg-secondary-color);
  box-shadow: 0 0 0 5px var(--bg-primary-color);
}

.timeline-content {
  min-width: 0;

  :deep(.booking-card) {
    border-radius: var(--r-l);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  :deep(.card-header) {
    padding: 0.65rem 1rem;
    gap: 0.5rem;
    background-color: transparent;
  }

  :deep(.title-icon) {
    display: none;
  }

  :deep(.card-title) {
    min-height: 0;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: 1.05rem;
  }

  :deep(.title-container) {
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  :deep(.card-title),
  :deep(.group-name) {
    flex-basis: 60%;
  }

  :deep(.card-body) {
    padding: 1rem;
  }
}

.timeline-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin-bottom: 0.4rem;
  color: var(--fg-tertiary-color);
  font-size: 0.75rem;

  time {
    color: var(--fg-secondary-color);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.timeline-type {
  color: var(--timeline-tone);
  font-weight: 600;
}

@include media-down(sm) {
  .bookings-timeline {
    --timeline-rail-width: 1.75rem;
    --timeline-gap: 0.65rem;
  }

  .timeline-date-text {
    flex-direction: column;
    font-size: 0.9rem;
  }

  .timeline-marker {
    margin-top: 1.95rem;
    font-size: 0.95rem;
    box-shadow: 0 0 0 3px var(--bg-primary-color);
  }

  .timeline-content {
    :deep(.card-header) {
      padding: 0.6rem 0.65rem;
    }
    :deep(.card-body) {
      padding: 0.75rem 0.65rem;
    }
    :deep(.card-title) {
      font-size: 0.95rem;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  margin-top: 1rem;
  text-align: center;
  color: var(--fg-tertiary-color);
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 2px dashed var(--border-secondary-color);
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}

@include media-down(sm) {
  .actions-panel {
    button:first-of-type {
      flex-grow: 1;
    }
  }
}
</style>
