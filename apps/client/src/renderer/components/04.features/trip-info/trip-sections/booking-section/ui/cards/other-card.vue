<script setup lang="ts">
import type { HighlightStatus } from '../../composables/use-booking-section'
import type { Booking, OtherData, OtherKind } from '../../models/types'
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { getBookingKindOptions, resolveBookingKind } from '../../models/booking-kinds'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingKindBadge from '../shared/booking-kind-badge.vue'
import BookingKindField from '../shared/booking-kind-field.vue'
import BookingLocationField from '../shared/booking-location-field.vue'
import BookingLocationViewer from '../shared/booking-location-viewer.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'other' }
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
  (e: 'update:booking', value: Booking & { type: 'other' }): void
}>()

const isStartPickerOpen = ref(false)
const isEndPickerOpen = ref(false)

const isStartViewerOpen = ref(false)
const isEndViewerOpen = ref(false)

const { copy, copied: isCopied } = useClipboard()

const kindOptions = getBookingKindOptions('other')

const kindMeta = computed(() => resolveBookingKind('other', props.booking.data.kind, props.booking.icon))

const kindIcon = computed(() => kindMeta.value?.icon || props.booking.icon || 'mdi:dots-horizontal-circle-outline')

function updateDataField<K extends keyof OtherData>(key: K, value: OtherData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

function updateKind(value?: string) {
  updateDataField('kind', value as OtherKind)
}

function copyReferenceNumber() {
  if (props.booking.data.bookingReference) {
    copy(props.booking.data.bookingReference)
    useToast().success('Номер бронирования скопирован')
  }
}

function formatPoint(iso?: string) {
  if (!iso)
    return { date: '', weekday: '', time: '' }
  const datePart = iso.split('T')[0]
  const dateObj = new Date(`${datePart}T12:00:00Z`)
  if (Number.isNaN(dateObj.getTime()))
    return { date: datePart, weekday: '', time: getTime(iso) }

  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj)
  const weekdayRaw = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(dateObj)

  return {
    date,
    weekday: weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1),
    time: getTime(iso),
  }
}

function getTime(iso?: string): string {
  if (!iso || !iso.includes('T'))
    return ''
  const timePart = iso.split('T')[1] || ''
  if (!timePart || timePart.startsWith('00:00'))
    return ''
  return timePart.substring(0, 5)
}

const startPoint = computed(() => formatPoint(props.booking.data.startDateTime))
const endPoint = computed(() => formatPoint(props.booking.data.endDateTime))

const routeLine = computed(() => {
  const { startLocation, endLocation } = props.booking.data
  if (startLocation && endLocation)
    return `${startLocation} → ${endLocation}`
  return startLocation || endLocation || ''
})

const hasCoords = computed(() => Boolean(props.booking.data.startCoords || props.booking.data.endCoords))
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="kindIcon"
    :readonly="readonly"
    :highlight-status="highlightStatus"
    :show-drag-handle="showDragHandle"
    @delete="emit('delete')"
    @update:title="updateTitle"
  >
    <template #badge>
      <BookingKindBadge v-if="kindMeta" :meta="kindMeta" />
    </template>

    <div class="other-view">
      <div class="other-hero-row">
        <div class="other-main-info">
          <div class="other-name-line">
            <Icon :icon="kindIcon" class="other-kind-icon" />
            <span class="other-name-text">
              {{ booking.data.name || booking.title || 'Перемещение' }}
            </span>
          </div>

          <div v-if="routeLine" class="other-route-line">
            <Icon icon="mdi:map-marker-outline" class="route-marker-icon" />
            <span class="route-text">{{ routeLine }}</span>
          </div>
        </div>

        <div v-if="hasCoords" class="other-actions-group">
          <KitBtn
            variant="subtle"
            size="xs"
            icon="mdi:map-search-outline"
            title="Посмотреть на карте"
            @click.stop="isStartViewerOpen = true"
          >
            На карте
          </KitBtn>
        </div>
      </div>

      <div v-if="booking.data.startDateTime" class="time-banner">
        <div class="time-point">
          <div class="time-tag">
            <Icon icon="mdi:clock-start" class="tag-icon" />
            <span>Начало</span>
          </div>
          <div class="time-value-row">
            <span class="time-date-val">{{ startPoint.date }}</span>
            <span v-if="startPoint.weekday" class="time-weekday-pill">{{ startPoint.weekday }}</span>
            <span v-if="startPoint.time" class="time-time-pill">
              <Icon icon="mdi:clock-outline" />
              {{ startPoint.time }}
            </span>
          </div>
        </div>

        <template v-if="booking.data.endDateTime">
          <Icon icon="mdi:arrow-right-thin" class="time-arrow" />
          <div class="time-point">
            <div class="time-tag">
              <Icon icon="mdi:clock-end" class="tag-icon" />
              <span>Окончание</span>
            </div>
            <div class="time-value-row">
              <span class="time-date-val">{{ endPoint.date }}</span>
              <span v-if="endPoint.weekday" class="time-weekday-pill">{{ endPoint.weekday }}</span>
              <span v-if="endPoint.time" class="time-time-pill">
                <Icon icon="mdi:clock-outline" />
                {{ endPoint.time }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <div v-if="booking.data.bookingReference" class="info-pills-row">
        <div class="info-pill info-pill--ref">
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

    <template #details>
      <div class="details-grid">
        <BookingKindField
          :model-value="booking.data.kind"
          :options="kindOptions"
          label="Тип перемещения"
          :readonly="readonly"
          class="span-2"
          @update:model-value="updateKind"
        />

        <BookingField
          v-if="!readonly || booking.data.name"
          :model-value="booking.data.name"
          label="Что это"
          icon="mdi:text-box-outline"
          :readonly="readonly"
          class="span-2"
          placeholder="например, Паром через Кольский залив"
          @update:model-value="updateDataField('name', $event)"
        />

        <div class="address-field-wrapper span-2">
          <BookingField
            :model-value="booking.data.startLocation"
            label="Место отправления"
            icon="mdi:map-marker-radius-outline"
            :readonly="readonly"
            placeholder="Адрес, причал, станция"
            @update:model-value="updateDataField('startLocation', $event)"
          />
          <KitBtn
            v-if="!readonly"
            icon="mdi:map-marker-outline"
            title="Указать на карте"
            @click="isStartPickerOpen = true"
          />
          <KitBtn
            v-if="readonly && booking.data.startCoords"
            icon="mdi:map-search-outline"
            title="Посмотреть на карте"
            variant="text"
            @click="isStartViewerOpen = true"
          />
        </div>

        <div class="address-field-wrapper span-2">
          <BookingField
            :model-value="booking.data.endLocation"
            label="Место прибытия"
            icon="mdi:map-marker-check-outline"
            :readonly="readonly"
            placeholder="Адрес, причал, станция"
            @update:model-value="updateDataField('endLocation', $event)"
          />
          <KitBtn
            v-if="!readonly"
            icon="mdi:map-marker-outline"
            title="Указать на карте"
            @click="isEndPickerOpen = true"
          />
          <KitBtn
            v-if="readonly && booking.data.endCoords"
            icon="mdi:map-search-outline"
            title="Посмотреть на карте"
            variant="text"
            @click="isEndViewerOpen = true"
          />
        </div>

        <BookingDateTimeField
          :model-value="booking.data.startDateTime"
          label="Начало"
          icon="mdi:clock-start"
          :readonly="readonly"
          type="datetime"
          @update:model-value="updateDataField('startDateTime', $event)"
        />
        <BookingField
          :model-value="booking.data.startTimeZone"
          label="Часовой пояс начала"
          icon="mdi:clock-time-four-outline"
          :readonly="readonly"
          placeholder="+03:00"
          @update:model-value="updateDataField('startTimeZone', $event)"
        />

        <BookingDateTimeField
          v-if="!readonly || booking.data.endDateTime"
          :model-value="booking.data.endDateTime"
          label="Окончание"
          icon="mdi:clock-end"
          :readonly="readonly"
          type="datetime"
          @update:model-value="updateDataField('endDateTime', $event)"
        />
        <BookingField
          v-if="!readonly || booking.data.endTimeZone"
          :model-value="booking.data.endTimeZone"
          label="Часовой пояс окончания"
          icon="mdi:clock-time-four-outline"
          :readonly="readonly"
          placeholder="+03:00"
          @update:model-value="updateDataField('endTimeZone', $event)"
        />

        <KitDivider v-if="!readonly || (booking.data.bookingReference || booking.data.sourceUrl)" class="span-2" />

        <BookingField
          v-if="!readonly || booking.data.bookingReference"
          :model-value="booking.data.bookingReference"
          label="Номер бронирования"
          icon="mdi:barcode-scan"
          :readonly="readonly"
          class="span-2"
          @update:model-value="updateDataField('bookingReference', $event)"
        />
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
    v-model:visible="isStartPickerOpen"
    :model-value="booking.data.startCoords"
    label="Точка отправления"
    :readonly="readonly"
    @update:model-value="updateDataField('startCoords', $event)"
  />

  <BookingLocationField
    v-if="!readonly"
    v-model:visible="isEndPickerOpen"
    :model-value="booking.data.endCoords"
    label="Точка прибытия"
    :readonly="readonly"
    @update:model-value="updateDataField('endCoords', $event)"
  />

  <BookingLocationViewer
    v-model:visible="isStartViewerOpen"
    :location="booking.data.startCoords"
    :title="booking.data.name || 'Точка отправления'"
  />

  <BookingLocationViewer
    v-model:visible="isEndViewerOpen"
    :location="booking.data.endCoords"
    :title="booking.data.name || 'Точка прибытия'"
  />
</template>

<style scoped lang="scss">
.other-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.other-hero-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.other-main-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}

.other-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.other-kind-icon {
  font-size: 1.15rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
}

.other-name-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.3;
}

.other-route-line {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.825rem;
  color: var(--fg-secondary-color);

  .route-marker-icon {
    font-size: 0.95rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .route-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.other-actions-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.time-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px 14px;
}

.time-point {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-tag {
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

.time-value-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.time-date-val {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.time-weekday-pill {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  background: var(--bg-secondary-color);
  border-radius: var(--r-s);
  padding: 1px 6px;
}

.time-time-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  background: var(--bg-secondary-color);
  border-radius: var(--r-s);
  padding: 1px 6px;
}

.time-arrow {
  font-size: 1.1rem;
  color: var(--fg-tertiary-color);
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
  padding: 4px 10px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-primary-color);

  .pill-icon {
    font-size: 1rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .pill-body {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .pill-label {
    font-size: 0.675rem;
    color: var(--fg-tertiary-color);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .pill-val {
    font-size: 0.825rem;
    color: var(--fg-primary-color);
  }
}

.pill-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  padding: 2px;

  &:hover {
    color: var(--fg-accent-color);
  }
}
</style>
