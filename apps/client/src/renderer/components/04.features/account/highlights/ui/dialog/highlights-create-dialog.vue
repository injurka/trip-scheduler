<script setup lang="ts">
import type { Country, DestinationReview } from '~/shared/types/models/destination-review'
import type { CreateHighlightInput } from '~/shared/types/models/user'
import { Icon } from '@iconify/vue'
import { CalendarDate, Time } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { toLonLat } from 'ol/proj'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitTimeField } from '~/components/01.kit/kit-time-field'

const props = defineProps<{
  visible: boolean
  countries: Country[]
  reviews: DestinationReview[]
  form: Partial<CreateHighlightInput>
  file: File | null
  isUploading: boolean
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'file-select', value: File | null): void
  (e: 'submit'): void
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const countryOptions = computed(() =>
  props.countries.map(country => ({
    value: country.id,
    label: country.name,
    flagUrl: country.flagUrl,
  })),
)

// Подсказки локаций на основе уже оставленных "Рейтингов"
const locationSuggestions = computed(() => {
  const map = new Map<string, { countryId: string, city: string, name: string, flagUrl: string | null }>()
  for (const r of props.reviews || []) {
    if (r.city && r.countryId) {
      const key = `${r.countryId}-${r.city}`
      if (!map.has(key)) {
        map.set(key, {
          countryId: r.countryId,
          city: r.city,
          name: r.city,
          flagUrl: r.country?.flagUrl || null,
        })
      }
    }
  }
  return Array.from(map.values())
})

function applySuggestion(loc: { countryId: string, city: string }) {
  props.form.countryId = loc.countryId
  props.form.city = loc.city
}

// --- Логика кастомного выбора Даты и Времени ---
const datePickerWrapperRef = ref<HTMLElement | null>(null)
const showDatePicker = ref(false)
const calendarDate = ref<CalendarDate | null>(null)
const timeValue = ref<Time | null>(null)
let isInternalDateUpdate = false

onClickOutside(datePickerWrapperRef, () => {
  showDatePicker.value = false
})

watch(() => props.form.takenAt, (val) => {
  if (isInternalDateUpdate) {
    isInternalDateUpdate = false
    return
  }
  if (val) {
    const d = new Date(val)
    if (!Number.isNaN(d.getTime())) {
      calendarDate.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
      timeValue.value = new Time(d.getHours(), d.getMinutes())
    }
  }
  else {
    calendarDate.value = null
    timeValue.value = null
  }
}, { immediate: true })

watch([calendarDate, timeValue], ([newDate, newTime]) => {
  isInternalDateUpdate = true
  if (newDate) {
    const d = new Date(
      newDate.year,
      newDate.month - 1,
      newDate.day,
      newTime?.hour || 0,
      newTime?.minute || 0,
    )
    props.form.takenAt = d.toISOString()
  }
  else {
    props.form.takenAt = null
  }
}, { deep: true })

const formattedTakenAt = computed(() => {
  if (!props.form.takenAt)
    return ''
  const d = new Date(props.form.takenAt)
  if (Number.isNaN(d.getTime()))
    return ''
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

watch(visibleModel, (val) => {
  if (!val)
    showDatePicker.value = false
})
// -------------------------------------------------

const mapCenter = ref<[number, number]>([20, 45])
const mapMarkers = computed(() => {
  const lat = Number(props.form.latitude)
  const lon = Number(props.form.longitude)
  if (!Number.isNaN(lat) && !Number.isNaN(lon) && props.form.latitude !== null && props.form.longitude !== null && props.form.latitude !== '' && props.form.longitude !== '') {
    return [{ id: 'pin', coords: { lat, lon } }]
  }
  return []
})

function handleMapClick(coords: [number, number]) {
  const [lon, lat] = toLonLat(coords)
  props.form.longitude = Number(lon.toFixed(6))
  props.form.latitude = Number(lat.toFixed(6))
}

const isSubmitDisabled = computed(() =>
  !props.form.imageUrl
  || !props.form.countryId
  || !props.form.city?.trim(),
)
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visibleModel"
    title="Добавить фото"
    :max-width="720"
    :persistent="isSubmitting || isUploading"
  >
    <div v-if="isSubmitting || isUploading" class="dialog-overlay-loader">
      <div class="dialog-overlay-loader-bg" />
      <div class="dialog-overlay-loader-content">
        <Icon icon="mdi:loading" class="spinner" />
        <span>{{ isUploading ? 'Загрузка фото...' : 'Сохранение...' }}</span>
      </div>
    </div>

    <div class="dialog-body">
      <KitFileInput
        :model-value="file"
        accept="image/*"
        :loading="isUploading"
        :preview-url="form.imageUrl || null"
        @update:model-value="emit('file-select', $event)"
      >
        {{ form.imageUrl ? 'Замени фото, если нужно обновить изображение' : 'Добавь фото: клик, drag&drop или вставка из буфера' }}
      </KitFileInput>

      <div v-if="form.imageUrl" class="form-grid">
        <div class="row">
          <KitSelectWithSearch
            v-model="form.countryId"
            :items="countryOptions"
            label="Страна"
            placeholder="Выбери страну"
          >
            <template #item="{ item }">
              <img v-if="item.flagUrl" :src="item.flagUrl" class="dropdown-flag" alt="">
              <span>{{ item.label }}</span>
            </template>
          </KitSelectWithSearch>

          <KitInput
            v-model="form.city"
            label="Город"
            placeholder="Например, Qingdao"
          />
        </div>

        <div v-if="locationSuggestions.length > 0" class="suggestions">
          <span class="suggestions-label">Ранее посещенные:</span>
          <div class="suggestions-list">
            <button
              v-for="loc in locationSuggestions"
              :key="loc.countryId + loc.city"
              class="suggestion-chip"
              type="button"
              @click="applySuggestion(loc)"
            >
              <img v-if="loc.flagUrl" :src="loc.flagUrl" class="chip-flag" alt="">
              {{ loc.name }}
            </button>
          </div>
        </div>

        <div class="row row--aligned">
          <KitInput
            v-model="form.address"
            label="Адрес"
            placeholder="Улица, район или точка на карте"
          />
          <div ref="datePickerWrapperRef" class="custom-datetime-picker">
            <label class="section-label">Дата и время съемки</label>
            <div
              class="date-trigger"
              :class="{ 'is-active': showDatePicker }"
              @click="showDatePicker = !showDatePicker"
            >
              <span class="date-text" :class="{ 'is-empty': !formattedTakenAt }">
                {{ formattedTakenAt || 'Не указано' }}
              </span>
              <Icon icon="mdi:calendar-blank" class="date-icon" />
            </div>

            <Transition name="dropdown-fade">
              <div v-if="showDatePicker" class="picker-inline">
                <KitCalendar v-model="calendarDate" />
                <div class="time-row">
                  <span class="time-label">Время:</span>
                  <KitTimeField v-model="timeValue" />
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <div class="map-section">
          <label class="section-label">Координаты</label>
          <div class="row row--coords">
            <KitInput
              v-model="form.latitude"
              type="number"
              step="any"
              placeholder="Широта"
            />
            <KitInput
              v-model="form.longitude"
              type="number"
              step="any"
              placeholder="Долгота"
            />
          </div>
          <p class="section-hint">
            Кликните по карте для выбора точного места
          </p>
          <div class="map-container">
            <KitMap
              :center="mapCenter"
              :zoom="2"
              height="400px"
              :markers="mapMarkers"
              :auto-pan="false"
              @click="handleMapClick"
            />
          </div>
        </div>

        <label class="textarea-field">
          <span class="textarea-label">Комментарий к фото</span>
          <textarea
            v-model="form.comment"
            class="textarea"
            rows="4"
            placeholder="Этот текст будет показан в viewer под фотографией"
          />
        </label>

        <div class="actions">
          <KitBtn variant="subtle" @click="visibleModel = false">
            Отмена
          </KitBtn>

          <KitBtn
            color="primary"
            :disabled="isSubmitDisabled"
            :loading="isSubmitting"
            @click="emit('submit')"
          >
            Загрузить
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.dialog-overlay-loader {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;

  &-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-primary-color);
    opacity: 0.7;
    border-radius: inherit;
  }

  &-content {
    position: relative;
    z-index: 51;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--fg-primary-color);
    font-weight: 500;

    .spinner {
      font-size: 2.5rem;
      color: var(--fg-accent-color);
      animation: spin 1s linear infinite;
    }
  }
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  &--aligned {
    align-items: start;
  }
}

.custom-datetime-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.date-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 46px;
  padding: 0 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }
  &.is-active {
    border-color: var(--border-focus-color);
  }
  .date-text {
    font-size: 1rem;
    color: var(--fg-primary-color);
    &.is-empty {
      color: var(--fg-tertiary-color);
    }
  }
  .date-icon {
    color: var(--fg-tertiary-color);
    font-size: 1.25rem;
  }
}

.picker-inline {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  box-shadow: var(--s-l);
  margin-top: 8px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;

  :deep(.calendar) {
    border: none;
    box-shadow: none;
    padding: 0;
    background: transparent;
    width: 100%;
    max-width: 300px;
  }

  @media (max-width: 720px) {
    left: 0;
    right: auto;
  }
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 300px;
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px solid var(--border-secondary-color);

  .time-label {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: -8px;
}

.suggestions-label {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
}

.suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion-chip {
  display: inline-flex;
  align-items: center;
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
}

.chip-flag {
  width: 14px;
  height: 10px;
  object-fit: cover;
  border-radius: 2px;
  margin-right: 6px;
}

.map-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-tertiary-color);
  padding: 12px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.section-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  margin-bottom: 4px;
}

.section-hint {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  margin: 4px 0;
}

.map-container {
  overflow: hidden;
  box-shadow: none;
}

.textarea-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions {
  display: flex;
  margin-left: auto;
  gap: 8px;
}

.textarea-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}

.textarea {
  width: 100%;
  resize: vertical;
  min-height: 100px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  padding: 0.9rem 1rem;
  font: inherit;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--border-focus-color);
    background: var(--bg-primary-color);
  }

  &::placeholder {
    color: var(--fg-tertiary-color);
  }
}

.dropdown-flag {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
