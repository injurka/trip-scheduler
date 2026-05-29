<script setup lang="ts">
import type { Country } from '~/shared/types/models/destination-review'
import { Icon } from '@iconify/vue'
import { toLonLat } from 'ol/proj'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitSlider } from '~/components/01.kit/kit-slider'
import { METRIC_KEYS, METRIC_LABELS } from '../../composables/use-destination-reviews'

const props = defineProps<{
  visible: boolean
  countries: Country[]
  form: any
  file: File | null
  isUploading: boolean
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:file', value: File | null): void
  (e: 'submit'): void
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const fileModel = computed({
  get: () => props.file,
  set: value => emit('update:file', value),
})

const step = ref(1)

watch(visibleModel, (val) => {
  if (val) {
    step.value = 1
  }
})

const countryOptions = computed(() => props.countries.map(c => ({
  value: c.id,
  label: c.name,
  flagUrl: c.flagUrl,
})))

const mapCenter = ref<[number, number]>([20, 45])
const mapMarkers = computed(() => {
  const lat = Number(props.form.latitude)
  const lon = Number(props.form.longitude)
  if (!Number.isNaN(lat) && !Number.isNaN(lon) && props.form.latitude !== '' && props.form.longitude !== '') {
    return [{ id: 'pin', coords: { lat, lon } }]
  }
  return []
})

function handleMapClick(coords: [number, number]) {
  const [lon, lat] = toLonLat(coords)
  props.form.longitude = Number(lon.toFixed(6))
  props.form.latitude = Number(lat.toFixed(6))
}

const isStep1Invalid = computed(() => {
  if (!props.form.countryId)
    return true
  if (!props.form.city)
    return true
  if (props.form.latitude === '' || props.form.longitude === '')
    return true
  return false
})

function goToStep(targetStep: number) {
  if (props.isSubmitting || props.isUploading)
    return
  if (targetStep > 1 && isStep1Invalid.value)
    return
  step.value = targetStep
}

function getSliderColor(value: number) {
  if (value <= 2)
    return 'error'
  if (value === 3)
    return 'warning'
  return 'success'
}
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visibleModel"
    title="Добавить впечатление"
    :max-width="600"
    persistent
  >
    <div v-if="isSubmitting || isUploading" class="dialog-overlay-loader">
      <div class="dialog-overlay-loader-bg" />
      <div class="dialog-overlay-loader-content">
        <Icon icon="mdi:loading" class="spinner" />
        <span>{{ isUploading ? 'Загрузка фото...' : 'Сохранение...' }}</span>
      </div>
    </div>

    <div class="form-wizard">
      <div class="stepper">
        <div class="step" :class="{ active: step >= 1, completed: step > 1, disabled: isSubmitting || isUploading }" @click="goToStep(1)">
          <div class="step-circle">
            1
          </div>
          <span class="step-label">Место</span>
        </div>
        <div class="step-line" :class="{ active: step > 1 }" />
        <div class="step" :class="{ active: step >= 2, completed: step > 2, disabled: isSubmitting || isUploading || isStep1Invalid }" @click="goToStep(2)">
          <div class="step-circle">
            2
          </div>
          <span class="step-label">Фото</span>
        </div>
        <div class="step-line" :class="{ active: step > 2 }" />
        <div class="step" :class="{ active: step >= 3, completed: step > 3, disabled: isSubmitting || isUploading || isStep1Invalid }" @click="goToStep(3)">
          <div class="step-circle">
            3
          </div>
          <span class="step-label">Оценки</span>
        </div>
        <div class="step-line" :class="{ active: step > 3 }" />
        <div class="step" :class="{ active: step >= 4, disabled: isSubmitting || isUploading || isStep1Invalid }" @click="goToStep(4)">
          <div class="step-circle">
            4
          </div>
          <span class="step-label">Отзыв</span>
        </div>
      </div>

      <!-- Шаг 1: Место -->
      <div v-if="step === 1" class="step-content">
        <KitSelectWithSearch v-model="form.countryId" :items="countryOptions" label="Страна" placeholder="Выберите страну">
          <template #item="{ item }">
            <img v-if="(item as any).flagUrl" :src="(item as any).flagUrl" class="dropdown-flag" alt="">
            <span>{{ item.label }}</span>
          </template>
        </KitSelectWithSearch>

        <KitInput v-model="form.city" label="Город" placeholder="Например: Париж" />

        <div class="map-section">
          <label class="section-label">Точка на карте</label>
          <div class="coords-inputs">
            <KitInput v-model="form.latitude" type="number" step="any" placeholder="Широта" />
            <KitInput v-model="form.longitude" type="number" step="any" placeholder="Долгота" />
          </div>
          <div class="map-container">
            <KitMap enable-search :center="mapCenter" :zoom="2" :markers="mapMarkers" height="400px" :auto-pan="false" @click="handleMapClick" />
          </div>
        </div>
      </div>

      <!-- Шаг 2: Фото -->
      <div v-if="step === 2" class="step-content">
        <h4 class="step-title">
          Главное фото
        </h4>
        <p class="section-hint">
          Выберите обложку, которая станет фоном карточки.
        </p>
        <KitFileInput v-model="fileModel" accept="image/*" :loading="isUploading">
          Нажмите чтобы загрузить фото
        </KitFileInput>
      </div>

      <!-- Шаг 3: Оценки -->
      <div v-if="step === 3" class="step-content step-scrollable">
        <h4 class="step-title">
          Оценки и метрики
        </h4>
        <div class="metrics-grid">
          <div v-for="key in METRIC_KEYS" :key="key" class="metric-row">
            <KitSlider
              v-model="form.metrics[key]"
              :label="METRIC_LABELS[key]"
              :min="1" :max="5" :step="1"
              :color="getSliderColor(form.metrics[key])"
              :value-formatter="v => `${v} / 5`"
            />
            <textarea
              v-model="form.metricComments[key]"
              class="metric-comment-input"
              placeholder="Ваш комментарий к оценке (опционально)"
              rows="2"
            />
          </div>
        </div>
      </div>

      <!-- Шаг 4: Отзыв -->
      <div v-if="step === 4" class="step-content step-content--textarea">
        <h4 class="step-title">
          Развернутый комментарий
        </h4>
        <p class="section-hint">
          Пара слов о главном (опционально)
        </p>
        <KitInlineMdEditorWrapper
          :model-value="form.content || ''"
          class="destination-comment"
          placeholder="Что больше всего запомнилось? Поделитесь эмоциями..."
          @update:model-value="form.content = $event"
        />
      </div>

      <!-- Кнопки управления -->
      <div class="wizard-actions">
        <KitBtn v-if="step > 1" variant="subtle" @click="step--">
          Назад
        </KitBtn>
        <div style="flex-grow: 1" />
        <KitBtn v-if="step < 4" :disabled="step === 1 && isStep1Invalid" @click="step++">
          Далее
        </KitBtn>
        <KitBtn v-if="step === 4" color="primary" :loading="isSubmitting" @click="emit('submit')">
          Сохранить
        </KitBtn>
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

.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 24px;
  padding: 0 10px;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 2;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover:not(.disabled) {
    transform: translateY(-2px);
  }
  &.disabled {
    cursor: not-allowed;
    opacity: 0.8;
  }
}
.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s;
}
.step-label {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
}
.step.active .step-circle {
  border: 2px solid var(--fg-accent-color);
  color: var(--fg-accent-color);
  background: var(--bg-primary-color);
}
.step.active .step-label {
  color: var(--fg-primary-color);
}
.step.completed .step-circle {
  background: var(--fg-accent-color);
  color: var(--bg-primary-color);
}
.step-line {
  flex-grow: 1;
  height: 3px;
  background: var(--bg-tertiary-color);
  margin: 0 8px 22px;
  border-radius: 2px;
}
.step-line.active {
  background: var(--fg-accent-color);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 400px;
}
.step-scrollable {
  overflow-y: auto;
  padding-right: 8px;
  max-height: 50vh;
}
.step-title {
  margin: 0;
  color: var(--fg-primary-color);
  font-weight: 600;
  font-size: 1.1rem;
}
.section-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}
.section-hint {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  margin: 0;
}

.map-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.coords-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.map-container {
  overflow: hidden;
  box-shadow: none;
}

.metrics-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.metric-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-tertiary-color);
  padding: 12px;
  border-radius: var(--r-m);
}

.metric-comment-input {
  width: 100%;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px 12px;
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 40px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--fg-accent-color);
  }
}

.destination-comment {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 6px;
}
.wizard-actions {
  display: flex;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
}
.dropdown-flag {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
  margin-right: 8px;
}
</style>
