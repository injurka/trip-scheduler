<script setup lang="ts">
import type { Booking, FlightData, FlightSegment } from '../../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import BookingCardWrapper from '../shared/booking-card-wrapper.vue'
import BookingDateTimeField from '../shared/booking-date-time-field.vue'
import BookingField from '../shared/booking-field.vue'
import BookingSourceLink from '../shared/booking-source-link.vue'
import BookingTextareaField from '../shared/booking-textarea-field.vue'

interface Props {
  booking: Booking & { type: 'flight' }
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update:booking', value: Booking & { type: 'flight' }): void
}>()

const segments = computed(() => props.booking.data.segments || [])
const firstSegment = computed(() => segments.value[0])
const lastSegment = computed(() => segments.value[segments.value.length - 1])

const uniqueAirlines = computed(() => {
  if (!segments.value || segments.value.length === 0)
    return []

  const seen = new Set()
  return segments.value
    .map(segment => ({
      iataCode: segment.airlineIataCode,
      name: segment.airline,
    }))
    .filter((airline) => {
      if (!airline.iataCode || seen.has(airline.iataCode))
        return false

      seen.add(airline.iataCode)
      return true
    })
})

/**
 * Генерирует URL для логотипа авиакомпании по её IATA-коду.
 * Использует правильный CDN Skyscanner.
 * @param iataCode Двухбуквенный IATA-код (например, 'SU').
 */
function getAirlineLogoUrl(iataCode?: string): string | null {
  if (!iataCode || iataCode.length < 2)
    return null
  // ИСПОЛЬЗУЕТСЯ ПРАВИЛЬНЫЙ ДОМЕН: www.skyscanner.net
  return `https://www.skyscanner.net/images/airlines/favicon/${iataCode.toUpperCase()}.png`
}

/**
 * Безопасно создает объект Date из локального времени и смещения часового пояса.
 * Возвращает null, если дата не может быть надежно создана (т.е. нет информации о поясе).
 * Это предотвращает использование некорректной локальной таймзоны браузера.
 * @param dateTime Локальное время, например, '2025-10-18T22:40:00'
 * @param timeZone Смещение, например, '+03:00'
 */
function createDateWithTimezone(dateTime?: string, timeZone?: string): Date | null {
  if (!dateTime)
    return null

  // Проверяем, содержит ли строка dateTime уже информацию о временной зоне
  const hasOffset = /Z|[+-]\d{2}(?::\d{2})?$/.test(dateTime)
  if (hasOffset) {
    const date = new Date(dateTime)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Если смещения нет в основной строке, оно должно быть в параметре timeZone
  if (timeZone) {
    const fullIso = `${dateTime}${timeZone}`
    const date = new Date(fullIso)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Если информация о часовом поясе отсутствует, мы не можем создать корректную дату.
  // Возвращаем null, чтобы избежать неверных расчетов.
  return null
}

/**
 * Форматирует локальную дату и время для отображения.
 * Эта функция не использует new Date() для форматирования, чтобы всегда показывать
 * время "как есть" в билете, а не в часовом поясе пользователя.
 */
function formatDisplayDateTime(localDateTime?: string) {
  if (!localDateTime)
    return { time: '', date: '' }
  try {
    const time = localDateTime.substring(11, 16)
    // Создаем дату в UTC, чтобы избежать смещения локальной зоной браузера при форматировании дня недели.
    const dateOnly = localDateTime.substring(0, 10)
    const dateObj = new Date(`${dateOnly}T12:00:00Z`) // Use noon to avoid DST issues
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })
    return { time, date: dateStr }
  }
  catch {
    return { time: '??:??', date: 'Неверная дата' }
  }
}

/**
 * Преобразует миллисекунды в строку "Чч Мм".
 */
function formatDuration(ms: number) {
  if (ms < 0)
    return '---'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.round((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}ч ${minutes}м`
}

/**
 * Общая продолжительность всего путешествия в миллисекундах.
 */
const totalDurationMs = computed(() => {
  const startDate = createDateWithTimezone(firstSegment.value?.departureDateTime, firstSegment.value?.departureTimeZone)
  const endDate = createDateWithTimezone(lastSegment.value?.arrivalDateTime, lastSegment.value?.arrivalTimeZone)
  if (!startDate || !endDate)
    return 0
  return endDate.getTime() - startDate.getTime()
})

/**
 * Общая продолжительность в отформатированном виде.
 */
const totalDurationFormatted = computed(() => {
  return formatDuration(totalDurationMs.value)
})

/**
 * Создает плоский массив всех "частей" путешествия (полеты и пересадки)
 * с рассчитанной шириной в процентах для визуализации.
 */
const journeySegments = computed(() => {
  if (totalDurationMs.value <= 0 || segments.value.length === 0)
    return []

  const journeyParts = []
  const totalMs = totalDurationMs.value

  for (let i = 0; i < segments.value.length; i++) {
    const segment = segments.value[i]
    const departureDate = createDateWithTimezone(segment.departureDateTime, segment.departureTimeZone)
    const arrivalDate = createDateWithTimezone(segment.arrivalDateTime, segment.arrivalTimeZone)

    if (!departureDate || !arrivalDate)
      continue

    // Добавляем полетный сегмент
    const flightDurationMs = arrivalDate.getTime() - departureDate.getTime()
    if (flightDurationMs > 0) {
      journeyParts.push({
        type: 'flight',
        widthPercent: (flightDurationMs / totalMs) * 100,
        tooltip: `В полете: ${formatDuration(flightDurationMs)}`,
      })
    }

    // Добавляем сегмент пересадки (если это не последний полет)
    if (i < segments.value.length - 1) {
      const nextSegment = segments.value[i + 1]
      const nextDepartureDate = createDateWithTimezone(nextSegment.departureDateTime, nextSegment.departureTimeZone)
      if (!nextDepartureDate)
        continue

      const layoverDurationMs = nextDepartureDate.getTime() - arrivalDate.getTime()
      if (layoverDurationMs > 0) {
        journeyParts.push({
          type: 'layover',
          widthPercent: (layoverDurationMs / totalMs) * 100,
          tooltip: `Пересадка: ${formatDuration(layoverDurationMs)}`,
        })
      }
    }
  }
  return journeyParts
})

/**
 * Продолжительность одного сегмента
 */
function segmentDuration(segment: FlightSegment) {
  const departureDate = createDateWithTimezone(segment.departureDateTime, segment.departureTimeZone)
  const arrivalDate = createDateWithTimezone(segment.arrivalDateTime, segment.arrivalTimeZone)
  if (!departureDate || !arrivalDate)
    return ''
  return formatDuration(
    arrivalDate.getTime() - departureDate.getTime(),
  )
}

function getLayoverDuration(prevSegment: FlightSegment, currentSegment: FlightSegment): string {
  const prevArrivalDate = createDateWithTimezone(prevSegment.arrivalDateTime, prevSegment.arrivalTimeZone)
  const currentDepartureDate = createDateWithTimezone(currentSegment.departureDateTime, currentSegment.departureTimeZone)
  if (!prevArrivalDate || !currentDepartureDate)
    return ''
  const durationMs = currentDepartureDate.getTime() - prevArrivalDate.getTime()
  return formatDuration(durationMs)
}

function updateTitle(newTitle: string) {
  emit('update:booking', { ...props.booking, title: newTitle })
}

function updateDataField<K extends keyof FlightData>(key: K, value: FlightData[K]) {
  emit('update:booking', {
    ...props.booking,
    data: { ...props.booking.data, [key]: value },
  })
}

/**
 * Обновляет поле в конкретном сегменте перелета.
 * @param segmentIndex - Индекс сегмента в массиве.
 * @param key - Ключ поля в объекте сегмента.
 * @param value - Новое значение.
 */
function updateSegmentField<K extends keyof FlightSegment>(segmentIndex: number, key: K, value: FlightSegment[K]) {
  const newSegments = JSON.parse(JSON.stringify(props.booking.data.segments || []))
  if (newSegments[segmentIndex]) {
    newSegments[segmentIndex][key] = value
    emit('update:booking', {
      ...props.booking,
      data: {
        ...props.booking.data,
        segments: newSegments,
      },
    })
  }
}
</script>

<template>
  <BookingCardWrapper
    :title="booking.title"
    :icon="booking.icon"
    :readonly="readonly"
    @delete="$emit('delete')"
    @update:title="updateTitle"
  >
    <div v-if="firstSegment" class="card-content">
      <div class="time-info">
        <div class="time">
          {{ formatDisplayDateTime(firstSegment.departureDateTime).time }}
        </div>
        <div class="city">
          {{ firstSegment.departureCity }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(firstSegment.departureDateTime).date }}
        </div>
      </div>

      <div class="route-visualizer">
        <div class="total-duration">
          {{ totalDurationFormatted }}
        </div>
        <div class="route-line">
          <template v-for="(part) in journeySegments" :key="part">
            <KitTooltip
              :name="part.tooltip"
              :style="{ width: `${part.widthPercent}%` }"
            >
              <div
                class="journey-part"
                :class="{
                  'part-flight': part.type === 'flight',
                  'part-layover': part.type === 'layover',
                }"
              />
            </KitTooltip>
          </template>
        </div>
        <div class="airports">
          <span>{{ firstSegment.departureAirport }}</span>
          <div class="airline-logos-center">
            <KitTooltip
              v-for="airline in uniqueAirlines"
              :key="airline.iataCode"
              :name="`${airline.name || airline.iataCode}`"
            >
              <div class="center-logo-wrapper">
                <img
                  v-if="getAirlineLogoUrl(airline.iataCode)"
                  :src="getAirlineLogoUrl(airline.iataCode)!"
                  class="center-logo-img"
                  alt=""
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
                <div class="center-logo-fallback">
                  <Icon icon="mdi:airplane" />
                </div>
              </div>
            </KitTooltip>
          </div>
          <span>{{ lastSegment.arrivalAirport }}</span>
        </div>
      </div>

      <div class="time-info arrival">
        <div class="time">
          {{ formatDisplayDateTime(lastSegment.arrivalDateTime).time }}
        </div>
        <div class="city">
          {{ lastSegment.arrivalCity }}
        </div>
        <div class="date">
          {{ formatDisplayDateTime(lastSegment.arrivalDateTime).date }}
        </div>
      </div>
    </div>

    <template #details>
      <div class="details-grid">
        <template v-for="(segment, index) in segments" :key="segment.flightNumber">
          <!-- Layover Info Block -->
          <div v-if="index > 0" class="layover-details span-2">
            <Icon icon="mdi:clock-outline" />
            Пересадка в г. {{ segments[index - 1].arrivalCity }} ({{ segments[index - 1].arrivalAirport }})
            <span>{{ getLayoverDuration(segments[index - 1], segment) }}</span>
          </div>

          <!-- Segment Details -->
          <div class="segment-header span-2">
            <div class="segment-header-content">
              <div class="airline-logo-container-small">
                <img
                  v-if="getAirlineLogoUrl(segment.airlineIataCode)"
                  :src="getAirlineLogoUrl(segment.airlineIataCode)!"
                  class="airline-logo-small"
                  alt=""
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
                <div class="airline-logo-fallback-small">
                  <Icon icon="mdi:airplane" />
                </div>
              </div>
              <span>Рейс {{ index + 1 }}</span>
            </div>
          </div>
          <BookingField :model-value="segment.airline" label="Авиакомпания" icon="mdi:compass-rose" :readonly="readonly" @update:model-value="updateSegmentField(index, 'airline', $event)" />
          <BookingField :model-value="segment.airlineIataCode" label="Код авиакомпании (IATA)" icon="mdi:barcode" :readonly="readonly" placeholder="SU" @update:model-value="updateSegmentField(index, 'airlineIataCode', $event)" />
          <BookingField :model-value="segment.departureCity" label="Город вылета" icon="mdi:city-variant-outline" :readonly="readonly" @update:model-value="updateSegmentField(index, 'departureCity', $event)" />
          <BookingField :model-value="segment.arrivalCity" label="Город прилета" icon="mdi:city-variant-outline" :readonly="readonly" @update:model-value="updateSegmentField(index, 'arrivalCity', $event)" />
          <BookingField :model-value="segment.departureAirport" label="Аэропорт вылета (IATA)" icon="mdi:airplane-takeoff" :readonly="readonly" @update:model-value="updateSegmentField(index, 'departureAirport', $event)" />
          <BookingField :model-value="segment.arrivalAirport" label="Аэропорт прилета (IATA)" icon="mdi:airplane-landing" :readonly="readonly" @update:model-value="updateSegmentField(index, 'arrivalAirport', $event)" />
          <BookingDateTimeField :model-value="segment.departureDateTime" label="Дата и время вылета" icon="mdi:clock-start" :readonly="readonly" type="datetime" @update:model-value="updateSegmentField(index, 'departureDateTime', $event)" />
          <BookingField :model-value="segment.departureTimeZone" label="Часовой пояс вылета" icon="mdi:clock-time-four-outline" :readonly="readonly" placeholder="+03:00" @update:model-value="updateSegmentField(index, 'departureTimeZone', $event)" />
          <BookingDateTimeField :model-value="segment.arrivalDateTime" label="Дата и время прилета" icon="mdi:clock-end" :readonly="readonly" type="datetime" @update:model-value="updateSegmentField(index, 'arrivalDateTime', $event)" />
          <BookingField :model-value="segment.arrivalTimeZone" label="Часовой пояс прилета" icon="mdi:clock-time-four-outline" :readonly="readonly" placeholder="+08:00" @update:model-value="updateSegmentField(index, 'arrivalTimeZone', $event)" />
          <BookingField :model-value="segment.terminalDeparture" label="Терминал вылета" icon="mdi:gate" :readonly="readonly" @update:model-value="updateSegmentField(index, 'terminalDeparture', $event)" />
          <BookingField :model-value="segment.terminalArrival" label="Терминал прилета" icon="mdi:gate" :readonly="readonly" @update:model-value="updateSegmentField(index, 'terminalArrival', $event)" />
          <BookingField :model-value="segment.aircraft" label="Самолет" icon="mdi:airplane" :readonly="readonly" @update:model-value="updateSegmentField(index, 'aircraft', $event)" />
          <BookingField :model-value="segmentDuration(segment)" label="В пути" icon="mdi:timer-sand" readonly />
        </template>

        <KitDivider class="span-2" />

        <BookingField
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
</template>

<style scoped lang="scss">
.card-content {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  align-items: center;
  gap: 1rem;
}

.time-info {
  text-align: left;
  .time {
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
  }
  .city {
    font-size: 1rem;
    font-weight: 500;
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
  min-width: 150px;
}

.total-duration {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  background-color: var(--bg-tertiary-color);
  padding: 2px 8px;
  border-radius: var(--r-full);
}

.route-line {
  width: 100%;
  height: 4px;
  background-color: var(--border-secondary-color);
  display: flex;
  align-items: center;
  position: relative;
  margin: 8px 0;

  > :first-child {
    border-top-left-radius: var(--r-full);
    border-bottom-left-radius: var(--r-full);
  }
  > :last-child {
    border-top-right-radius: var(--r-full);
    border-bottom-right-radius: var(--r-full);
  }

  &::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--fg-tertiary-color);
    z-index: 2;
  }
  &::after {
    content: '';
    position: absolute;
    right: -1px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--fg-tertiary-color);
    z-index: 2;
  }

  :deep(.tooltip-name) {
    font-size: 0.875rem;
    font-weight: 600;
  }
}

.journey-part {
  width: 100%;
  height: 100%;
  transition: filter 0.2s ease;
  height: 4px;

  &.part-flight {
    background-color: var(--fg-accent-color);
  }

  &.part-layover {
    background-image: linear-gradient(
      45deg,
      var(--bg-tertiary-color) 25%,
      transparent 25%,
      transparent 50%,
      var(--bg-tertiary-color) 50%,
      var(--bg-tertiary-color) 75%,
      transparent 75%,
      transparent 100%
    );
    background-size: 8px 8px;
    cursor: pointer;
  }
}

.airports {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-accent-color);

  > span:first-child {
    text-align: left;
  }
  > span:last-child {
    text-align: right;
  }
}

.airline-logos-center {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 4px;
}

.center-logo-wrapper {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary-color);
  background-color: var(--bg-tertiary-color);

  &:not(:first-child) {
    margin-left: -10px;
  }
}

.center-logo-img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: white;
  border-radius: 50%;
  z-index: 1;
}

.center-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--fg-tertiary-color);
  font-size: 0.8rem;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.span-2 {
  grid-column: span 2 / span 2;
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;

  &::after {
    content: '';
    flex: 1 1 auto;
    height: 1px;
    background-color: var(--border-secondary-color);
  }
}

.segment-header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.airline-logo-container-small {
  position: relative;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 100%;
  overflow: hidden;
}

.airline-logo-small {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  z-index: 1;
}

.airline-logo-fallback-small {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-tertiary-color);
  font-size: 1rem;
}

.layover-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-tertiary-color);
  padding: 0.5rem 0.75rem;
  border-radius: var(--r-s);
  font-size: 0.9rem;
  margin-top: 1rem;
  span {
    margin-left: auto;
    font-weight: 600;
  }
}

@include media-down(sm) {
  .card-content {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    text-align: center;
  }

  .time-info {
    order: 1;
    text-align: center;
    align-items: center;

    &.arrival {
      order: 3;
      text-align: center;
      align-items: center;
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
  }
}
</style>
