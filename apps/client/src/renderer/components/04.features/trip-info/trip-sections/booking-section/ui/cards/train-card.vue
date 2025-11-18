<script setup lang="ts">
import type { Booking, TrainData } from '../../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingLocationField from '../shared/booking-location-field.vue'
import BookingLocationViewer from '../shared/booking-location-viewer.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'train' }
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'train' }): void
}>()

const isDepartureLocationPickerOpen = ref(false)
const isArrivalLocationPickerOpen = ref(false)

const isDepartureLocationViewerOpen = ref(false)
const isArrivalLocationViewerOpen = ref(false)

function updateDataField<K extends keyof TrainData>(key: K, value: TrainData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

function createDateWithTimezone(dateTime?: string, timeZone?: string): Date | null {
  if (!dateTime)
    return null
  const hasOffset = /Z|[+-]\d{2}(?::\d{2})?$/.test(dateTime)
  if (hasOffset) {
    const date = new Date(dateTime)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (timeZone) {
    const fullIso = `${dateTime}${timeZone}`
    const date = new Date(fullIso)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function formatDisplayDateTime(localDateTime?: string) {
  if (!localDateTime)
    return { time: '', date: '' }
  try {
    const time = localDateTime.substring(11, 16)
    const dateOnly = localDateTime.substring(0, 10)
    const dateObj = new Date(`${dateOnly}T12:00:00Z`)
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })
    return { time, date: dateStr }
  }
  catch {
    return { time: '??:??', date: 'Неверная дата' }
  }
}

function formatDuration(ms: number) {
  if (ms < 0)
    return '---'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.round((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}ч ${minutes}м`
}

const totalDurationMs = computed(() => {
  const startDate = createDateWithTimezone(props.booking.data.departureDateTime, props.booking.data.departureTimeZone)
  const endDate = createDateWithTimezone(props.booking.data.arrivalDateTime, props.booking.data.arrivalTimeZone)
  if (!startDate || !endDate)
    return 0
  return endDate.getTime() - startDate.getTime()
})

const totalDurationFormatted = computed(() => {
  return formatDuration(totalDurationMs.value)
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
      <div class="time-info">
        <div class="time">
          {{ formatDisplayDateTime(booking.data.departureDateTime).time }}
        </div>
        <div class="station">
          {{ booking.data.departureStation }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(booking.data.departureDateTime).date }}
        </div>
      </div>

      <div class="route-visualizer">
        <div class="total-duration">
          {{ totalDurationFormatted }}
        </div>
        <div class="route-line">
          <div class="route-icon">
            <Icon icon="mdi:train" />
          </div>
        </div>
        <div class="stations">
          <span>{{ booking.data.departureStation }}</span>
          <span>{{ booking.data.arrivalStation }}</span>
        </div>
      </div>

      <div class="time-info arrival">
        <div class="time">
          {{ formatDisplayDateTime(booking.data.arrivalDateTime).time }}
        </div>
        <div class="station">
          {{ booking.data.arrivalStation }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(booking.data.arrivalDateTime).date }}
        </div>
      </div>
    </div>

    <template #details>
      <div class="details-grid">
        <div class="address-field-wrapper span-2">
          <BookingField :model-value="booking.data.departureStation" label="Станция отправления" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('departureStation', $event)" />
          <KitBtn v-if="!readonly" icon="mdi:map-marker-outline" title="Указать на карте" @click="isDepartureLocationPickerOpen = true" />
          <KitBtn v-if="readonly && booking.data.departureStationLocation" icon="mdi:map-search-outline" title="Посмотреть на карте" variant="text" @click="isDepartureLocationViewerOpen = true" />
        </div>
        <div class="address-field-wrapper span-2">
          <BookingField :model-value="booking.data.arrivalStation" label="Станция прибытия" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('arrivalStation', $event)" />
          <KitBtn v-if="!readonly" icon="mdi:map-marker-outline" title="Указать на карте" @click="isArrivalLocationPickerOpen = true" />
          <KitBtn v-if="readonly && booking.data.arrivalStationLocation" icon="mdi:map-search-outline" title="Посмотреть на карте" variant="text" @click="isArrivalLocationViewerOpen = true" />
        </div>

        <BookingDateTimeField :model-value="booking.data.departureDateTime" label="Дата и время отправления" icon="mdi:clock-start" :readonly="readonly" type="datetime" @update:model-value="updateDataField('departureDateTime', $event)" />
        <BookingField :model-value="booking.data.departureTimeZone" label="Часовой пояс отправления" icon="mdi:clock-time-four-outline" :readonly="readonly" placeholder="+03:00" @update:model-value="updateDataField('departureTimeZone', $event)" />

        <BookingDateTimeField :model-value="booking.data.arrivalDateTime" label="Дата и время прибытия" icon="mdi:clock-end" :readonly="readonly" type="datetime" @update:model-value="updateDataField('arrivalDateTime', $event)" />
        <BookingField :model-value="booking.data.arrivalTimeZone" label="Часовой пояс прибытия" icon="mdi:clock-time-four-outline" :readonly="readonly" placeholder="+08:00" @update:model-value="updateDataField('arrivalTimeZone', $event)" />

        <BookingField :model-value="booking.data.departurePlatform" label="Путь/платформа (отпр.)" icon="mdi:sign-direction" :readonly="readonly" @update:model-value="updateDataField('departurePlatform', $event)" />
        <BookingField :model-value="booking.data.arrivalPlatform" label="Путь/платформа (приб.)" icon="mdi:sign-direction" :readonly="readonly" @update:model-value="updateDataField('arrivalPlatform', $event)" />

        <BookingField :model-value="booking.data.trainNumber" label="Номер поезда" icon="mdi:pound" :readonly="readonly" @update:model-value="updateDataField('trainNumber', $event)" />
        <BookingField :model-value="totalDurationFormatted" label="В пути" icon="mdi:timer-sand" readonly />

        <BookingField :model-value="booking.data.carriage" label="Вагон" icon="mdi:train-car" :readonly="readonly" @update:model-value="updateDataField('carriage', $event)" />
        <BookingField :model-value="booking.data.seat" label="Место" icon="mdi:seat-passenger" :readonly="readonly" @update:model-value="updateDataField('seat', $event)" />

        <BookingField :model-value="booking.data.bookingReference" label="Номер бронирования" icon="mdi:barcode-scan" :readonly="readonly" class="span-2" @update:model-value="updateDataField('bookingReference', $event)" />

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
        <BookingSourceLink
          v-else
          :url="booking.data.sourceUrl"
          label="Ссылка на бронирование"
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
    v-model:visible="isDepartureLocationPickerOpen"
    :model-value="booking.data.departureStationLocation"
    label="Локация станции отправления"
    :readonly="readonly"
    @update:model-value="updateDataField('departureStationLocation', $event)"
  />
  <BookingLocationField
    v-if="!readonly"
    v-model:visible="isArrivalLocationPickerOpen"
    :model-value="booking.data.arrivalStationLocation"
    label="Локация станции прибытия"
    :readonly="readonly"
    @update:model-value="updateDataField('arrivalStationLocation', $event)"
  />

  <BookingLocationViewer
    v-model:visible="isDepartureLocationViewerOpen"
    :location="booking.data.departureStationLocation"
    :title="booking.data.departureStation || 'Станция отправления'"
  />
  <BookingLocationViewer
    v-model:visible="isArrivalLocationViewerOpen"
    :location="booking.data.arrivalStationLocation"
    :title="booking.data.arrivalStation || 'Станция прибытия'"
  />
</template>

<style scoped lang="scss">
.card-content {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
}

.time-info {
  text-align: left;
  .time {
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
  }
  .station {
    font-size: 1rem;
    font-weight: 500;
    white-space: nowrap;
  }
  .date {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }
  &.arrival {
    text-align: right;
  }
}

.route-visualizer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 120px;
}

.total-duration {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  background-color: var(--bg-tertiary-color);
  padding: 2px 8px;
  margin-bottom: 4px;
  border-radius: var(--r-full);
}

.route-line {
  width: 100%;
  height: 2px;
  background-color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 8px 0;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--fg-tertiary-color);
  }
  &::before {
    left: -1px;
  }
  &::after {
    right: -1px;
  }
}

.route-icon {
  color: var(--fg-tertiary-color);
  background-color: var(--bg-secondary-color);
  padding: 0 4px;
  font-size: 1.2rem;
}

.stations {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-accent-color);
}

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

@include media-down(sm) {
  .card-content {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    text-align: center;
  }
  .time-info {
    text-align: center;
    order: 1;

    &.arrival {
      text-align: center;
      order: 3;
    }
  }
  .route-visualizer {
    order: 2;
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    box-shadow: var(--s-l);
    margin: 8px 0;
    padding: 16px 16px 8px 8px;
    border-radius: var(--r-l);

    .route-icon {
      background-color: var(--bg-primary-color);
    }
  }

  .span-2 {
    grid-column: span 1 / span 1;
  }
}
</style>
