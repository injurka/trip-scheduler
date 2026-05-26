<script setup lang="ts">
import type { Country, DestinationReview } from '~/shared/types/models/destination-review'
import type { CreateHighlightInput } from '~/shared/types/models/user'
import { toLonLat } from 'ol/proj'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'

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
    title="Редактировать фото"
    :max-width="720"
  >
    <div class="dialog-body">
      <KitFileInput
        :model-value="file"
        accept="image/*"
        :loading="isUploading"
        :preview-url="null"
        @update:model-value="emit('file-select', $event)"
      >
        Замени изображение при необходимости или оставь текущее фото
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

        <KitInput
          v-model="form.address"
          label="Адрес"
          placeholder="Улица, район или точка"
        />

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
            Кликните по карте для изменения координат
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
            placeholder="Комментарий будет показан в viewer"
          />
        </label>
      </div>
    </div>

    <template #actions>
      <KitBtn variant="subtle" @click="visibleModel = false">
        Отмена
      </KitBtn>

      <KitBtn
        color="primary"
        :disabled="isSubmitDisabled"
        :loading="isSubmitting"
        @click="emit('submit')"
      >
        Сохранить изменения
      </KitBtn>
    </template>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
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
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  margin-bottom: 4px;
}

.section-hint {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  margin: 4px 0;
}

.map-container {
  border-radius: var(--r-s);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

.textarea-field {
  display: flex;
  flex-direction: column;
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
