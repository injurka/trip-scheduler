<script setup lang="ts">
import type { HighlightStatus } from '../../composables/use-booking-section'
import type { Booking, CarData } from '../../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingLocationField from '../shared/booking-location-field.vue'
import BookingLocationViewer from '../shared/booking-location-viewer.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'car' }
  readonly: boolean
  highlightStatus?: HighlightStatus
  showDragHandle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  highlightStatus: null,
  showDragHandle: true,
})

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'car' }): void
}>()

const isPickupLocationPickerOpen = ref(false)
const isDropoffLocationPickerOpen = ref(false)

const isPickupLocationViewerOpen = ref(false)
const isDropoffLocationViewerOpen = ref(false)

function updateDataField<K extends keyof CarData>(key: K, value: CarData[K]) {
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
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}д ${remHours}ч`
  }
  return `${hours}ч ${minutes}м`
}

const totalDurationMs = computed(() => {
  const startDate = createDateWithTimezone(props.booking.data.pickupDateTime, props.booking.data.pickupTimeZone)
  const endDate = createDateWithTimezone(props.booking.data.dropoffDateTime, props.booking.data.dropoffTimeZone)
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
    :icon="booking.icon || 'mdi:car'"
    :readonly="readonly"
    :highlight-status="highlightStatus"
    :show-drag-handle="showDragHandle"
    @delete="$emit('delete')"
    @update:title="updateTitle"
  >
    <div class="card-content">
      <div class="time-info">
        <div class="time">
          {{ formatDisplayDateTime(booking.data.pickupDateTime).time || '—' }}
        </div>
        <div class="station">
          {{ booking.data.pickupLocation || 'Место подачи' }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(booking.data.pickupDateTime).date }}
        </div>
      </div>

      <div class="route-visualizer">
        <div class="total-duration">
          {{ totalDurationFormatted !== '---' ? totalDurationFormatted : (booking.data.carModel || booking.data.company || 'Авто') }}
        </div>
        <div class="route-line">
          <div class="route-icon">
            <Icon icon="mdi:car" />
          </div>
        </div>
        <div class="stations">
          <span>{{ booking.data.company || 'Подача' }}</span>
          <span>{{ booking.data.carModel || 'Возврат' }}</span>
        </div>
      </div>

      <div class="time-info arrival">
        <div class="time">
          {{ formatDisplayDateTime(booking.data.dropoffDateTime).time || '—' }}
        </div>
        <div class="station">
          {{ booking.data.dropoffLocation || 'Место возврата' }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(booking.data.dropoffDateTime).date }}
        </div>
      </div>
    </div>

    <template #details>
      <div class="details-grid">
        <BookingField
          :model-value="booking.data.company"
          label="Компания / Перевозчик"
          icon="mdi:domain"
          :readonly="readonly"
          placeholder="например, Hertz, Sixt, Трансфер"
          @update:model-value="updateDataField('company', $event)"
        />
        <BookingField
          :model-value="booking.data.carModel"
          label="Модель / Марка авто"
          icon="mdi:car-info"
          :readonly="readonly"
          placeholder="например, Toyota RAV4 4WD"
          @update:model-value="updateDataField('carModel', $event)"
        />

        <div class="address-field-wrapper span-2">
          <BookingField
            :model-value="booking.data.pickupLocation"
            label="Место получения / посадки"
            icon="mdi:map-marker-radius-outline"
            :readonly="readonly"
            placeholder="Адрес или пункт подачи"
            @update:model-value="updateDataField('pickupLocation', $event)"
          />
          <KitBtn
            v-if="!readonly"
            icon="mdi:map-marker-outline"
            title="Указать на карте"
            @click="isPickupLocationPickerOpen = true"
          />
          <KitBtn
            v-if="readonly && booking.data.pickupCoords"
            icon="mdi:map-search-outline"
            title="Посмотреть на карте"
            variant="text"
            @click="isPickupLocationViewerOpen = true"
          />
        </div>

        <div class="address-field-wrapper span-2">
          <BookingField
            :model-value="booking.data.dropoffLocation"
            label="Место возврата / высадки"
            icon="mdi:map-marker-check-outline"
            :readonly="readonly"
            placeholder="Адрес или пункт возврата"
            @update:model-value="updateDataField('dropoffLocation', $event)"
          />
          <KitBtn
            v-if="!readonly"
            icon="mdi:map-marker-outline"
            title="Указать на карте"
            @click="isDropoffLocationPickerOpen = true"
          />
          <KitBtn
            v-if="readonly && booking.data.dropoffCoords"
            icon="mdi:map-search-outline"
            title="Посмотреть на карте"
            variant="text"
            @click="isDropoffLocationViewerOpen = true"
          />
        </div>

        <BookingDateTimeField
          :model-value="booking.data.pickupDateTime"
          label="Дата и время получения"
          icon="mdi:clock-start"
          :readonly="readonly"
          type="datetime"
          @update:model-value="updateDataField('pickupDateTime', $event)"
        />
        <BookingField
          :model-value="booking.data.pickupTimeZone"
          label="Часовой пояс получения"
          icon="mdi:clock-time-four-outline"
          :readonly="readonly"
          placeholder="+03:00"
          @update:model-value="updateDataField('pickupTimeZone', $event)"
        />

        <BookingDateTimeField
          :model-value="booking.data.dropoffDateTime"
          label="Дата и время возврата"
          icon="mdi:clock-end"
          :readonly="readonly"
          type="datetime"
          @update:model-value="updateDataField('dropoffDateTime', $event)"
        />
        <BookingField
          :model-value="booking.data.dropoffTimeZone"
          label="Часовой пояс возврата"
          icon="mdi:clock-time-four-outline"
          :readonly="readonly"
          placeholder="+03:00"
          @update:model-value="updateDataField('dropoffTimeZone', $event)"
        />

        <BookingField
          :model-value="booking.data.carType"
          label="Класс авто"
          icon="mdi:car-side"
          :readonly="readonly"
          placeholder="Внедорожник, Седан, Минивэн"
          @update:model-value="updateDataField('carType', $event)"
        />
        <BookingField
          :model-value="booking.data.confirmationNumber"
          label="Номер бронирования / ваучера"
          icon="mdi:barcode-scan"
          :readonly="readonly"
          @update:model-value="updateDataField('confirmationNumber', $event)"
        />

        <BookingField
          :model-value="booking.data.phone"
          label="Телефон"
          icon="mdi:phone"
          :readonly="readonly"
          placeholder="+7 (999) 000-00-00"
          @update:model-value="updateDataField('phone', $event)"
        />
        <BookingField
          :model-value="booking.data.email"
          label="Email"
          icon="mdi:email"
          :readonly="readonly"
          placeholder="support@rental.com"
          @update:model-value="updateDataField('email', $event)"
        />

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
    v-model:visible="isPickupLocationPickerOpen"
    :model-value="booking.data.pickupCoords"
    label="Локация получения автомобиля"
    :readonly="readonly"
    @update:model-value="updateDataField('pickupCoords', $event)"
  />
  <BookingLocationField
    v-if="!readonly"
    v-model:visible="isDropoffLocationPickerOpen"
    :model-value="booking.data.dropoffCoords"
    label="Локация возврата автомобиля"
    :readonly="readonly"
    @update:model-value="updateDataField('dropoffCoords', $event)"
  />

  <BookingLocationViewer
    v-model:visible="isPickupLocationViewerOpen"
    :location="booking.data.pickupCoords"
    :title="booking.data.pickupLocation || 'Место получения'"
  />
  <BookingLocationViewer
    v-model:visible="isDropoffLocationViewerOpen"
    :location="booking.data.dropoffCoords"
    :title="booking.data.dropoffLocation || 'Место возврата'"
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
    overflow: hidden;
    text-overflow: ellipsis;
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
