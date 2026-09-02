<script setup lang="ts">
import type { HighlightStatus } from '../../composables/use-booking-section'
import type { Booking, HotelData } from '../../models/types'
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
  booking: Booking & { type: 'hotel' }
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
  (e: 'update:booking', value: Booking & { type: 'hotel' }): void
}>()

const isLocationPickerOpen = ref(false)
const isLocationViewerOpen = ref(false)

const { copy, copied: isCopied } = useClipboard()

function updateDataField<K extends keyof HotelData>(key: K, value: HotelData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

function copyConfirmationNumber() {
  if (props.booking.data.confirmationNumber) {
    copy(props.booking.data.confirmationNumber)
    useToast().success('Номер бронирования скопирован')
  }
}

const hotelWebsiteUrl = computed(() => {
  const web = props.booking.data.website
  if (!web)
    return null

  if (web.startsWith('http'))
    return web

  return `https://${web}`
})

const nightsCount = computed(() => {
  if (!props.booking.data.checkInDate || !props.booking.data.checkOutDate)
    return null
  const inDate = new Date(props.booking.data.checkInDate.split('T')[0])
  const outDate = new Date(props.booking.data.checkOutDate.split('T')[0])
  const diffTime = outDate.getTime() - inDate.getTime()
  if (Number.isNaN(diffTime) || diffTime <= 0)
    return null
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
})

function formatNights(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11)
    return `${n} ночь`
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return `${n} ночи`
  return `${n} ночей`
}

function formatStayDate(iso?: string): string {
  if (!iso)
    return '—'
  const d = new Date(iso.split('T')[0])
  if (Number.isNaN(d.getTime()))
    return iso
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function getStayWeekday(iso?: string): string {
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

const hasQuickInfo = computed(() => {
  const d = props.booking.data
  return Boolean(d.roomType || d.guests || d.confirmationNumber)
})
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="booking.icon"
    :readonly="readonly"
    :highlight-status="highlightStatus"
    :show-drag-handle="showDragHandle"
    @delete="$emit('delete')"
    @update:title="updateTitle"
  >
    <!-- READONLY MODE -->
    <div v-if="readonly" class="hotel-view">
      <!-- Hotel Primary Line & Badges -->
      <div class="hotel-hero-row">
        <div class="hotel-main-info">
          <div class="hotel-name-line">
            <span class="hotel-name-text">
              {{ booking.data.hotelName || booking.title || 'Отель' }}
            </span>
          </div>

          <div v-if="booking.data.address" class="hotel-address-line">
            <Icon icon="mdi:map-marker-outline" class="address-icon" />
            <span class="address-text">{{ booking.data.address }}</span>
          </div>
        </div>

        <div class="hotel-actions-group">
          <KitTooltip
            v-if="hotelWebsiteUrl"
            :text="`Открыть сайт отеля: ${booking.data.website}`"
          >
            <a
              :href="hotelWebsiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="hotel-action-chip"
              @click.stop
            >
              <Icon icon="mdi:web" />
              <span>Сайт</span>
              <Icon icon="mdi:open-in-new" class="ext-icon" />
            </a>
          </KitTooltip>

          <KitBtn
            v-if="booking.data.location"
            variant="subtle"
            size="xs"
            icon="mdi:map-search-outline"
            class="hotel-map-btn"
            title="Посмотреть на карте"
            @click.stop="isLocationViewerOpen = true"
          >
            На карте
          </KitBtn>
        </div>
      </div>

      <!-- Stay Dates Widget (Check-in ➔ Nights ➔ Check-out) -->
      <div v-if="booking.data.checkInDate || booking.data.checkOutDate" class="stay-banner">
        <div class="stay-point stay-checkin">
          <div class="stay-tag">
            <Icon icon="mdi:calendar-arrow-right" class="tag-icon tag-icon--in" />
            <span>Заезд</span>
          </div>
          <div class="stay-date-val">
            {{ formatStayDate(booking.data.checkInDate) }}
          </div>
          <div v-if="booking.data.checkInDate" class="stay-weekday-val">
            {{ getStayWeekday(booking.data.checkInDate) }}
          </div>
        </div>

        <div class="stay-connector">
          <div class="connector-line" />
          <div v-if="nightsCount" class="nights-badge">
            <Icon icon="mdi:moon-waning-crescent" class="moon-icon" />
            <span>{{ formatNights(nightsCount) }}</span>
          </div>
          <div v-else class="nights-badge simple">
            <Icon icon="mdi:arrow-right" />
          </div>
          <div class="connector-line" />
        </div>

        <div class="stay-point stay-checkout">
          <div class="stay-tag">
            <Icon icon="mdi:calendar-arrow-left" class="tag-icon tag-icon--out" />
            <span>Выезд</span>
          </div>
          <div class="stay-date-val">
            {{ formatStayDate(booking.data.checkOutDate) }}
          </div>
          <div v-if="booking.data.checkOutDate" class="stay-weekday-val">
            {{ getStayWeekday(booking.data.checkOutDate) }}
          </div>
        </div>
      </div>

      <!-- Quick Info Pills (Room type, Guests, Booking reference) -->
      <div v-if="hasQuickInfo" class="info-pills-row">
        <div v-if="booking.data.roomType" class="info-pill">
          <Icon icon="mdi:bed-outline" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Номер</span>
            <span class="pill-val">{{ booking.data.roomType }}</span>
          </div>
        </div>

        <div v-if="booking.data.guests" class="info-pill">
          <Icon icon="mdi:account-group-outline" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Гости</span>
            <span class="pill-val">{{ booking.data.guests }}</span>
          </div>
        </div>

        <div v-if="booking.data.confirmationNumber" class="info-pill info-pill--ref">
          <Icon icon="mdi:barcode-scan" class="pill-icon" />
          <div class="pill-body">
            <span class="pill-label">Бронь</span>
            <span class="pill-val font-mono">{{ booking.data.confirmationNumber }}</span>
          </div>
          <KitTooltip text="Скопировать номер бронирования">
            <button class="pill-copy-btn" @click.stop="copyConfirmationNumber">
              <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
            </button>
          </KitTooltip>
        </div>
      </div>
    </div>

    <!-- EDIT MODE -->
    <div v-else class="card-content">
      <BookingField
        :model-value="booking.data.hotelName"
        label="Название отеля"
        icon="mdi:office-building-outline"
        :readonly="readonly"
        class="span-2"
        @update:model-value="updateDataField('hotelName', $event)"
      />

      <div class="address-field-wrapper span-2">
        <BookingField :model-value="booking.data.address" label="Адрес (текстом)" icon="mdi:map-marker-radius-outline" :readonly="readonly" @update:model-value="updateDataField('address', $event)" />
        <KitBtn icon="mdi:map-marker-outline" title="Указать на карте" @click="isLocationPickerOpen = true" />
      </div>

      <BookingDateTimeField :model-value="booking.data.checkInDate" label="Дата заезда" icon="mdi:calendar-arrow-right" :readonly="readonly" type="date" @update:model-value="updateDataField('checkInDate', $event)" />
      <BookingDateTimeField :model-value="booking.data.checkOutDate" label="Дата выезда" icon="mdi:calendar-arrow-left" :readonly="readonly" type="date" @update:model-value="updateDataField('checkOutDate', $event)" />
    </div>

    <template #details>
      <div class="details-grid">
        <BookingField v-if="!readonly || booking.data.roomType" :model-value="booking.data.roomType" label="Тип номера" icon="mdi:bed-outline" :readonly="readonly" @update:model-value="updateDataField('roomType', $event)" />
        <BookingField v-if="!readonly || booking.data.guests" :model-value="booking.data.guests" label="Количество гостей" icon="mdi:account-group-outline" :readonly="readonly" @update:model-value="updateDataField('guests', $event)" />

        <KitDivider v-if="!readonly || (booking.data.confirmationNumber || booking.data.sourceUrl)" class="span-2" />

        <BookingField v-if="!readonly || booking.data.confirmationNumber" :model-value="booking.data.confirmationNumber" label="Номер подтверждения" icon="mdi:barcode-scan" :readonly="readonly" class="span-2" @update:model-value="updateDataField('confirmationNumber', $event)" />
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
        <BookingSourceLink v-else-if="booking.data.sourceUrl" :url="booking.data.sourceUrl" label="Ссылка на бронирование" />

        <KitDivider v-if="!readonly || (booking.data.phone || booking.data.email || booking.data.website)" class="span-2" />

        <BookingField v-if="!readonly || booking.data.phone" :model-value="booking.data.phone" label="Телефон" icon="mdi:phone-outline" :readonly="readonly" link-type="tel" @update:model-value="updateDataField('phone', $event)" />
        <BookingField v-if="!readonly || booking.data.email" :model-value="booking.data.email" label="Email" icon="mdi:email-outline" :readonly="readonly" link-type="email" @update:model-value="updateDataField('email', $event)" />
        <BookingField v-if="!readonly || booking.data.website" :model-value="booking.data.website" label="Веб-сайт отеля" icon="mdi:web" :readonly="readonly" class="span-2" link-type="web" @update:model-value="updateDataField('website', $event)" />

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
.hotel-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hotel-hero-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hotel-main-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}

.hotel-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hotel-name-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.3;
}

.hotel-address-line {
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

.hotel-actions-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.hotel-action-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-accent-color);
  font-size: 0.775rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
    border-color: var(--fg-accent-color);
  }

  .ext-icon {
    font-size: 0.75rem;
    opacity: 0.8;
  }
}

.hotel-map-btn {
  font-size: 0.775rem;
}

.stay-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px 14px;
  gap: 12px;

  @media (max-width: 540px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
}

.stay-point {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  &.stay-checkout {
    text-align: right;

    @media (max-width: 540px) {
      text-align: left;
    }

    .stay-tag {
      justify-content: flex-end;

      @media (max-width: 540px) {
        justify-content: flex-start;
      }
    }
  }
}

.stay-tag {
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

    &--in {
      color: var(--fg-success-color);
    }
    &--out {
      color: var(--fg-warning-color);
    }
  }
}

.stay-date-val {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  white-space: nowrap;
}

.stay-weekday-val {
  font-size: 0.775rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
}

.stay-connector {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 8px;
  min-width: 80px;

  @media (max-width: 540px) {
    justify-content: center;
  }
}

.connector-line {
  flex: 1;
  height: 1px;
  background: var(--border-secondary-color);
}

.nights-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  white-space: nowrap;
  flex-shrink: 0;

  .moon-icon {
    color: var(--fg-accent-color);
    font-size: 0.8rem;
  }

  &.simple {
    padding: 3px 6px;
    color: var(--fg-tertiary-color);
  }
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
