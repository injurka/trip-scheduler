<script setup lang="ts">
import type { Booking, HotelData } from '../../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingLocationField from '../shared/booking-location-field.vue'
import BookingLocationViewer from '../shared/booking-location-viewer.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'hotel' }
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'hotel' }): void
}>()

const isLocationPickerOpen = ref(false)
const isLocationViewerOpen = ref(false)

function updateDataField<K extends keyof HotelData>(key: K, value: HotelData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

const hotelWebsiteUrl = computed(() => {
  const web = props.booking.data.website
  if (!web)
    return null

  if (web.startsWith('http'))
    return web

  return `https://${web}`
})
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="booking.icon"
    :readonly="readonly"
    @delete="$emit('delete')"
    @update:title="updateTitle"
  >
    <div class="card-content">
      <BookingField
        v-if="!readonly"
        :model-value="booking.data.hotelName"
        label="Название отеля"
        icon="mdi:office-building-outline"
        :readonly="readonly"
        class="span-2"
        @update:model-value="updateDataField('hotelName', $event)"
      />
      <div v-else class="booking-field span-2">
        <label class="field-label">Название отеля</label>
        <a
          v-if="hotelWebsiteUrl"
          :href="hotelWebsiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hotel-name-link-wrapper"
          :title="`Открыть сайт отеля: ${booking.data.website}`"
        >
          <KitBtn variant="text" class="hotel-name-btn">
            <Icon icon="mdi:office-building-outline" class="field-icon" />
            <span class="readonly-value">{{ booking.data.hotelName || 'Название не указано' }}</span>
            <Icon icon="mdi:open-in-new" class="external-link-icon" />
          </KitBtn>
        </a>
        <div v-else class="readonly-content">
          <Icon icon="mdi:office-building-outline" class="field-icon" />
          <span v-if="booking.data.hotelName" class="readonly-value">{{ booking.data.hotelName }}</span>
          <span v-else class="readonly-placeholder">...</span>
        </div>
      </div>

      <div class="address-field-wrapper span-2">
        <BookingField :model-value="booking.data.address" label="Адрес (текстом)" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('address', $event)" />
        <KitBtn v-if="!readonly" icon="mdi:map-marker-outline" title="Указать на карте" @click="isLocationPickerOpen = true" />
        <KitBtn v-if="readonly && booking.data.location" icon="mdi:map-search-outline" variant="text" title="Посмотреть на карте" @click="isLocationViewerOpen = true" />
      </div>
      <BookingDateTimeField :model-value="booking.data.checkInDate" label="Дата заезда" icon="mdi:calendar-arrow-right" :readonly="readonly" type="date" @update:model-value="updateDataField('checkInDate', $event)" />
      <BookingDateTimeField :model-value="booking.data.checkOutDate" label="Дата выезда" icon="mdi:calendar-arrow-left" :readonly="readonly" type="date" @update:model-value="updateDataField('checkOutDate', $event)" />
    </div>

    <template #details>
      <div class="details-grid">
        <!-- Stay Details -->
        <BookingField :model-value="booking.data.roomType" label="Тип номера" icon="mdi:bed-outline" :readonly="readonly" @update:model-value="updateDataField('roomType', $event)" />
        <BookingField :model-value="booking.data.guests" label="Количество гостей" icon="mdi:account-group-outline" :readonly="readonly" @update:model-value="updateDataField('guests', $event)" />

        <KitDivider class="span-2" />

        <!-- Booking Info -->
        <BookingField :model-value="booking.data.confirmationNumber" label="Номер подтверждения" icon="mdi:barcode-scan" :readonly="readonly" class="span-2" @update:model-value="updateDataField('confirmationNumber', $event)" />
        <BookingField
          v-if="!readonly"
          :model-value="booking.data.sourceUrl"
          label="Ссылка на бронирование"
          icon="mdi:link-variant"
          :readonly="readonly"
          class="span-2"
          placeholder="https://..."
          @update:model-value="updateDataField('sourceUrl', $event)"
        />
        <BookingSourceLink :url="booking.data.sourceUrl" label="Ссылка на бронирование" />

        <KitDivider class="span-2" />

        <!-- Hotel Contact Info -->
        <BookingField :model-value="booking.data.phone" label="Телефон" icon="mdi:phone-outline" :readonly="readonly" link-type="tel" @update:model-value="updateDataField('phone', $event)" />
        <BookingField :model-value="booking.data.email" label="Email" icon="mdi:email-outline" :readonly="readonly" link-type="email" @update:model-value="updateDataField('email', $event)" />
        <BookingField :model-value="booking.data.website" label="Веб-сайт отеля" icon="mdi:web" :readonly="readonly" class="span-2" link-type="web" @update:model-value="updateDataField('website', $event)" />

        <KitDivider v-if="!readonly || booking.data.notes" class="span-2" />

        <!-- Notes -->
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
    label="Локация отеля"
    :readonly="readonly"
    @update:model-value="updateDataField('location', $event)"
  />

  <BookingLocationViewer
    v-model:visible="isLocationViewerOpen"
    :location="booking.data.location"
    :title="booking.data.hotelName || 'Просмотр локации'"
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

.booking-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-label {
  font-size: 0.75rem;
  margin-left: 2px;
  color: var(--fg-tertiary-color);
  font-weight: 500;
}

.readonly-content {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  box-sizing: border-box;
  padding: 6px 2px;
}

.field-icon {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.readonly-value {
  color: var(--fg-primary-color);
  line-height: 1.4;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.readonly-placeholder {
  color: var(--fg-tertiary-color);
}

.hotel-name-link-wrapper {
  text-decoration: none;
  margin: 0 -8px;
}

.hotel-name-btn {
  width: 100%;
  height: auto;
  min-height: 36px;
  padding: 6px 8px;
  display: flex;
  justify-content: flex-start;
  gap: 6px;
  text-transform: none;
  font-weight: normal;
  font-family: inherit;

  .readonly-value {
    color: var(--fg-primary-color);
  }

  .external-link-icon {
    margin-left: auto;
    font-size: 1rem;
    color: var(--fg-tertiary-color);
    transition: color 0.2s ease;
  }

  &:hover .external-link-icon {
    color: var(--fg-accent-color);
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
