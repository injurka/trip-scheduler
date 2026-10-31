<script setup lang="ts">
import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import type { Day } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useBookingSection } from '../composables'
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
  days?: Day[]
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
  timelineGroups,
  bookingHighlightMap,
  timelineHighlightMap,
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
                  :key="entry.id"
                  class="timeline-item"
                  :class="[`timeline-tone-${entry.booking.type}`, { 'is-highlighted': timelineHighlightMap[entry.id] }]"
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
                      <span v-if="entry.sublabel" class="timeline-sublabel">{{ entry.sublabel }}</span>
                    </div>
                    <Component
                      :is="getCardComponent(entry.booking.type)"
                      :booking="entry.booking as any"
                      v-bind="entry.booking.type === 'flight' && entry.segmentRange ? { segmentRange: entry.segmentRange } : {}"
                      :readonly="readonly"
                      :show-drag-handle="false"
                      :highlight-status="timelineHighlightMap[entry.id]"
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
  gap: 1.75rem;
  padding: 0.5rem 0;
}

.timeline-day {
  position: relative;

  & + & {
    padding-top: 1.75rem;
    border-top: 2px dashed var(--border-secondary-color);
  }
}

.timeline-date {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1.25rem;
  padding: 0.65rem 0.9rem;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-left: 4px solid var(--fg-accent-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-xs);
}

.timeline-date-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  flex-shrink: 0;
  border-radius: var(--r-s);
  background: rgba(var(--fg-accent-color-rgb), 0.12);
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);
  color: var(--fg-accent-color);
  font-size: 1.15rem;
}

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

.timeline-date-text {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  column-gap: 0.65rem;
  row-gap: 0.2rem;
  min-width: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.timeline-weekday {
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--fg-secondary-color);
  background: var(--bg-tertiary-color);
  padding: 0.1rem 0.55rem;
  border-radius: var(--r-full);
}

.timeline-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  padding: 0.15rem 0.6rem;
  white-space: nowrap;
}

.timeline-items {
  position: relative;
  list-style: none;
  padding: 0;
  margin: 0;
  gap: 1.25rem;

  &::before {
    content: '';
    position: absolute;
    z-index: 0;
    top: -1.25rem;
    bottom: 2rem;
    left: calc(var(--timeline-rail-width) / 2 - 1px);
    width: 2px;
    background: var(--border-secondary-color);
  }
}

.timeline-item {
  display: grid;
  grid-template-columns: var(--timeline-rail-width) minmax(0, 1fr);
  gap: var(--timeline-gap);
  --timeline-tone: #94a3b8;

  &.timeline-tone-flight {
    --timeline-tone: #3b82f6;
  }
  &.timeline-tone-hotel {
    --timeline-tone: #10b981;
  }
  &.timeline-tone-train {
    --timeline-tone: #8b5cf6;
  }
  &.timeline-tone-car {
    --timeline-tone: #f59e0b;
  }
  &.timeline-tone-other {
    --timeline-tone: #94a3b8;
  }
  &.timeline-tone-attraction {
    --timeline-tone: #ec4899;
  }

  &.is-highlighted .timeline-marker {
    border-color: var(--timeline-tone);
  }
}

.timeline-marker {
  position: relative;
  z-index: 1;
  margin-top: 1.75rem;
  color: var(--timeline-tone);
  background: var(--bg-secondary-color);
  border-color: color-mix(in srgb, var(--timeline-tone) 40%, var(--border-secondary-color));
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

.timeline-sublabel {
  color: var(--fg-tertiary-color);
  font-weight: 500;
}

@include media-down(sm) {
  .bookings-timeline {
    --timeline-rail-width: 1.75rem;
    --timeline-gap: 0.65rem;
  }

  .timeline-date {
    padding: 0.55rem 0.75rem;
    gap: 0.65rem;
  }

  .timeline-date-marker {
    width: 1.85rem;
    height: 1.85rem;
    font-size: 1rem;
  }

  .timeline-date-text {
    align-items: baseline;
    font-size: 0.92rem;
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
