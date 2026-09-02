<script setup lang="ts">
import type { HighlightStatus } from '../../composables/use-booking-section'
import type { AttractionData, Booking } from '../../models/types'
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
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
  highlightStatus?: HighlightStatus
  showDragHandle?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  highlightStatus: null,
  showDragHandle: true,
})
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'attraction' }): void
}>()

const isLocationPickerOpen = ref(false)
const isLocationViewerOpen = ref(false)

const { copy, copied: isCopied } = useClipboard()

function updateDataField<K extends keyof AttractionData>(key: K, value: AttractionData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

function copyReferenceNumber() {
  if (props.booking.data.bookingReference) {
    copy(props.booking.data.bookingReference)
    useToast().success('Номер бронирования/билета скопирован')
  }
}

function formatEventDate(iso?: string): string {
  if (!iso)
    return '—'
  const d = new Date(iso.split('T')[0])
  if (Number.isNaN(d.getTime()))
    return iso
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function getEventWeekday(iso?: string): string {
  if (!iso)
    return ''
  const d = new Date(iso.split('T')[0])
  if (Number.isNaN(d.getTime()))
    return ''
  const wd = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
  }).format(d)
  return wd.charAt(0).toUpperCase() + wd.slice(1)
}

function getEventTime(iso?: string): string | null {
  if (!iso || !iso.includes('T'))
    return null
  const timePart = iso.split('T')[1]
  if (!timePart || timePart.startsWith('00:00:00') || timePart.startsWith('00:00'))
    return null
  return timePart.substring(0, 5)
}

const hasQuickInfo = computed(() => {
  const d = props.booking.data
  return Boolean(d.ticketType || d.guests || d.bookingReference)
})
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="booking.icon || 'mdi:ticket-confirmation-outline'"
    :readonly="readonly"
    :highlight-status="highlightStatus"
    :show-drag-handle="showDragHandle"
    @delete="emit('delete')"
    @update:title="updateTitle"
  >
    <!-- READONLY MODE -->
    <div v-if="readonly" class="attraction-view">
      <!-- Attraction Hero Row -->
      <div class="attraction-hero-row">
        <div class="attraction-main-info">
          <div class="attraction-name-line">
            <span class="attraction-name-text">
              {{ booking.data.attractionName || booking.title || 'Достопримечательность / Событие' }}
            </span>
          </div>

          <div v-if="booking.data.address" class="attraction-address-line">
            <Icon icon="mdi:map-marker-outline" class="address-icon" />
            <span class="address-text">{{ booking.data.address }}</span>
          </div>
        </div>

        <div v-if="booking.data.location" class="attraction-actions-group">
          <KitBtn
            variant="subtle"
            size="xs"
            icon="mdi:map-search-outline"
            class="attraction-map-btn"
            title="Посмотреть на карте"
            @click.stop="isLocationViewerOpen = true"
          >
            На карте
          </KitBtn>
        </div>
      </div>

      <!-- Event Date & Time Banner -->
      <div v-if="booking.data.dateTime" class="event-banner">
        <div class="event-point">
          <div class="event-tag">
            <Icon icon="mdi:calendar-clock" class="tag-icon" />
            <span>Дата и время</span>
          </div>
          <div class="event-date-row">
            <span class="event-date-val">{{ formatEventDate(booking.data.dateTime) }}</span>
            <span v-if="getEventWeekday(booking.data.dateTime)" class="event-weekday-pill">
              {{ getEventWeekday(booking.data.dateTime) }}
            </span>
            <span v-if="getEventTime(booking.data.dateTime)" class="event-time-pill">
              <Icon icon="mdi:clock-outline" />
              {{ getEventTime(booking.data.dateTime) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Info Pills -->
      <div v-if="hasQuickInfo" class="info-pills-row">
        <div v-if="booking.data.ticketType" class="info-pill">
          <Icon icon="mdi:ticket-outline" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Билет</span>
            <span class="pill-val">{{ booking.data.ticketType }}</span>
          </div>
        </div>

        <div v-if="booking.data.guests" class="info-pill">
          <Icon icon="mdi:account-group-outline" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Гости</span>
            <span class="pill-val">{{ booking.data.guests }}</span>
          </div>
        </div>

        <div v-if="booking.data.bookingReference" class="info-pill info-pill--ref">
          <Icon icon="mdi:barcode-scan" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Бронь</span>
            <span class="pill-val font-mono">{{ booking.data.bookingReference }}</span>
          </div>
          <KitTooltip text="Скопировать номер бронирования">
            <button class="pill-copy-btn" @click.stop="copyReferenceNumber">
              <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
            </button>
          </KitTooltip>
        </div>
      </div>
    </div>

    <!-- EDIT MODE -->
    <div v-else class="card-content">
      <BookingField :model-value="booking.data.attractionName" label="Название места/события" icon="mdi:text-box-outline" :readonly="readonly" class="span-2" @update:model-value="updateDataField('attractionName', $event)" />
      <div class="address-field-wrapper span-2">
        <BookingField :model-value="booking.data.address" label="Адрес (текстом)" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('address', $event)" />
        <KitBtn icon="mdi:map-marker-outline" title="Указать на карте" @click="isLocationPickerOpen = true" />
      </div>
      <BookingDateTimeField :model-value="booking.data.dateTime" label="Дата и время" icon="mdi:calendar-clock" :readonly="readonly" type="datetime" @update:model-value="updateDataField('dateTime', $event)" />
    </div>

    <template #details>
      <div class="details-grid">
        <BookingField v-if="!readonly || booking.data.ticketType" :model-value="booking.data.ticketType" label="Тип билета" icon="mdi:ticket-outline" :readonly="readonly" @update:model-value="updateDataField('ticketType', $event)" />
        <BookingField v-if="!readonly || booking.data.guests" :model-value="booking.data.guests" label="Количество гостей" icon="mdi:account-group-outline" :readonly="readonly" @update:model-value="updateDataField('guests', $event)" />

        <KitDivider v-if="!readonly || (booking.data.bookingReference || booking.data.sourceUrl)" class="span-2" />

        <BookingField v-if="!readonly || booking.data.bookingReference" :model-value="booking.data.bookingReference" label="Номер бронирования/билета" icon="mdi:barcode-scan" :readonly="readonly" class="span-2" @update:model-value="updateDataField('bookingReference', $event)" />
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
          v-else-if="booking.data.sourceUrl"
          :url="booking.data.sourceUrl"
          label="Ссылка на источник"
        />

        <KitDivider v-if="!readonly || booking.data.notes" class="span-2" />

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
.attraction-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attraction-hero-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.attraction-main-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}

.attraction-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.attraction-name-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.3;
}

.attraction-address-line {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.825rem;
  color: var(--fg-secondary-color);

  .address-icon {
    font-size: 0.95rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .address-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
  }
}

.attraction-actions-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.attraction-map-btn {
  font-size: 0.775rem;
}

.event-banner {
  display: flex;
  align-items: center;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px 14px;
}

.event-point {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.event-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.725rem;
  font-weight: 600;
  color: var(--fg-tertiary-color);
  text-transform: uppercase;
  letter-spacing: 0.4px;

  .tag-icon {
    font-size: 0.85rem;
    color: var(--fg-accent-color);
  }
}

.event-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.event-date-val {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.event-weekday-pill {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  background-color: var(--bg-tertiary-color);
  padding: 2px 6px;
  border-radius: var(--r-xs);
}

.event-time-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
  padding: 2px 8px;
  border-radius: var(--r-xs);
}

.info-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.info-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  font-size: 0.825rem;

  .pill-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .pill-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .pill-label {
    font-size: 0.675rem;
    font-weight: 600;
    color: var(--fg-tertiary-color);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .pill-val {
    font-size: 0.825rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.font-mono {
      font-family: monospace;
      font-weight: 600;
    }
  }

  &--ref {
    padding-right: 6px;
  }
}

.pill-copy-btn {
  background: transparent;
  border: none;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--r-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  margin-left: 4px;

  &:hover {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.card-content,
.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.span-2 {
  grid-column: span 2 / span 2;
  min-width: 0;
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
