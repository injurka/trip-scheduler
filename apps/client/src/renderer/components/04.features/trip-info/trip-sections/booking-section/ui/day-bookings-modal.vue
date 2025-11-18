<script setup lang="ts">
import type { Booking } from '../models/types'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useBookingSection } from '../composables/use-booking-section'
import AttractionCard from './cards/attraction-card.vue'
import FlightCard from './cards/flight-card.vue'
import HotelCard from './cards/hotel-card.vue'
import TrainCard from './cards/train-card.vue'

interface Props {
  bookings: Booking[]
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { activeTab, bookingGroups, tabItems, allBookingsSorted } = useBookingSection({
  section: {
    id: 'day-bookings-modal',
    type: 'booking',
    content: { bookings: props.bookings },
  },
  readonly: true,
}, () => {})

const cardComponents = {
  flight: FlightCard,
  hotel: HotelCard,
  train: TrainCard,
  attraction: AttractionCard,
}

function getCardComponent(type: Booking['type']) {
  return cardComponents[type]
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Бронирования на этот день"
    icon="mdi:ticket-confirmation-outline"
    :max-width="800"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="day-bookings-content">
      <KitTabs v-if="tabItems.length > 0" v-model="activeTab" :items="tabItems">
        <template #timeline>
          <div class="bookings-grid">
            <div v-for="booking in allBookingsSorted" :key="booking.id">
              <Component
                :is="getCardComponent(booking.type)"
                :booking="booking as any"
                :readonly="true"
              />
            </div>
          </div>
        </template>

        <template v-for="tab in tabItems.filter(t => t.id !== 'timeline')" :key="tab.id" #[tab.id]>
          <div class="bookings-grid">
            <div v-for="booking in bookingGroups[tab.id]" :key="booking.id">
              <Component
                :is="getCardComponent(booking.type)"
                :booking="booking as any"
                :readonly="true"
              />
            </div>
          </div>
        </template>
      </KitTabs>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.day-bookings-content {
  padding-top: 8px;
}
.bookings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
</style>
