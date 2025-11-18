<script setup lang="ts">
import type { Booking, BookingSectionContent, BookingType } from '../models/types'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useBookingSection } from '../composables'
import AttractionCard from './cards/attraction-card.vue'
import FlightCard from './cards/flight-card.vue'
import HotelCard from './cards/hotel-card.vue'
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
  attraction: AttractionCard,
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
        @click="isAddDialogOpen = true"
      >
        Добавить бронирование
      </KitBtn>
      <KitBtn
        icon="mdi:magic-staff"
        variant="outlined"
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
          <div class="bookings-grid">
            <div v-for="booking in allBookingsSorted" :key="booking.id">
              <Component
                :is="getCardComponent(booking.type)"
                :booking="booking as any"
                :readonly="readonly"
                @delete="deleteBooking(booking.id)"
                @update:booking="updateBooking"
              />
            </div>
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
  gap: 1rem;
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
  grid-template-columns: 1fr;
  gap: 1rem;
}

.ghost-item {
  opacity: 0.5;
  background: var(--bg-accent-color);
  border-radius: var(--r-m);
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
</style>
