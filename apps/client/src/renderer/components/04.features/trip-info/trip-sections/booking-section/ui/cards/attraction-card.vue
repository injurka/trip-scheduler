<script setup lang="ts">
import type { AttractionData, Booking } from '../../models/types'
import { ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingLocationField from '../shared/booking-location-field.vue'
import BookingLocationViewer from '../shared/booking-location-viewer.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'attraction' }
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'attraction' }): void
}>()

const isLocationPickerOpen = ref(false)
const isLocationViewerOpen = ref(false)

function updateDataField<K extends keyof AttractionData>(key: K, value: AttractionData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="booking.icon"
    :readonly="readonly"
    @delete="emit('delete')"
    @update:title="updateTitle"
  >
    <div class="card-content">
      <BookingField :model-value="booking.data.attractionName" label="Название места/события" icon="mdi:text-box-outline" :readonly="readonly" class="span-2" @update:model-value="updateDataField('attractionName', $event)" />
      <div class="address-field-wrapper span-2">
        <BookingField :model-value="booking.data.address" label="Адрес (текстом)" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('address', $event)" />
        <KitBtn v-if="!readonly" icon="mdi:map-marker-outline" title="Указать на карте" @click="isLocationPickerOpen = true" />
        <KitBtn v-if="readonly && booking.data.location" icon="mdi:map-search-outline" title="Посмотреть на карте" variant="text" @click="isLocationViewerOpen = true" />
      </div>
      <BookingDateTimeField :model-value="booking.data.dateTime" label="Дата и время" icon="mdi:calendar-clock" :readonly="readonly" type="datetime" @update:model-value="updateDataField('dateTime', $event)" />
    </div>

    <template #details>
      <div class="details-grid">
        <BookingField :model-value="booking.data.ticketType" label="Тип билета" icon="mdi:ticket-outline" :readonly="readonly" @update:model-value="updateDataField('ticketType', $event)" />
        <BookingField :model-value="booking.data.guests" label="Количество гостей" icon="mdi:account-group-outline" :readonly="readonly" @update:model-value="updateDataField('guests', $event)" />
        <BookingField :model-value="booking.data.bookingReference" label="Номер бронирования/билета" icon="mdi:barcode-scan" :readonly="readonly" class="span-2" @update:model-value="updateDataField('bookingReference', $event)" />
        <BookingField
          v-if="!readonly"
          :model-value="booking.data.sourceUrl"
          label="Ссылка на источник"
          icon="mdi:link-variant"
          :readonly="readonly"
          class="span-2"
          placeholder="https://..."
          @update:model-value="updateDataField('sourceUrl', $event)"
        />
        <BookingSourceLink
          v-else
          :url="booking.data.sourceUrl"
          label="Ссылка на источник"
        />
        <BookingTextareaField
          v-if="!readonly || booking.data.notes"
          :model-value="booking.data.notes"
          label="Заметки"
          icon="mdi:note-text-outline"
          :readonly="readonly"
          class="span-2"
          @update:model-value="updateDataField('notes', $event)"
        />
      </div>
    </template>
  </BookingCardWrapper>

  <BookingLocationField
    v-if="!readonly"
    v-model:visible="isLocationPickerOpen"
    :model-value="booking.data.location"
    label="Локация"
    :readonly="readonly"
    @update:model-value="updateDataField('location', $event)"
  />

  <BookingLocationViewer
    v-model:visible="isLocationViewerOpen"
    :location="booking.data.location"
    :title="booking.data.attractionName || 'Просмотр локации'"
  />
</template>

<style scoped lang="scss">
.card-content,
.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.span-2 {
  grid-column: span 2 / span 2;
}

.address-field-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;

  :deep(.booking-field) {
    flex-grow: 1;
  }
  .kit-btn {
    flex-shrink: 0;
    height: 36px;
  }
}

@media (max-width: 600px) {
  .card-content,
  .details-grid {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: span 1 / span 1;
  }
}
</style>
