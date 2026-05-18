<script setup lang="ts">
import type { Country } from '~/shared/types/models/destination-review'
import { toLonLat } from 'ol/proj'
import { computed, reactive, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitSlider } from '~/components/01.kit/kit-slider'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

const props = defineProps<{ countries: Country[] }>()
const emit = defineEmits(['success'])
const visible = defineModel<boolean>('visible', { required: true })

const auth = useAuthStore()
const toast = useToast()

const step = ref(1)
const isSubmitting = ref(false)

const form = reactive({
  type: 'city',
  countryId: '',
  city: '',
  coverFile: null as File | null,
  latitude: '' as number | string,
  longitude: '' as number | string,
  content: '',
  metrics: { infrastructure: 3, nature: 3, food: 3, prices: 3, vibe: 3 },
})

const metricLabels: Record<string, string> = {
  infrastructure: 'Инфраструктура',
  nature: 'Природа',
  food: 'Еда',
  prices: 'Цены',
  vibe: 'Атмосфера',
}

const countryOptions = computed(() => {
  return props.countries.map(c => ({ value: c.id, label: c.name, flagUrl: c.flagUrl }))
})

const mapCenter = ref<[number, number]>([20, 45])
const mapMarkers = computed(() => {
  const lat = Number(form.latitude)
  const lon = Number(form.longitude)
  if (!Number.isNaN(lat) && !Number.isNaN(lon) && form.latitude !== '' && form.longitude !== '') {
    return [{ id: 'pin', coords: { lat, lon } }]
  }
  return []
})

function handleMapClick(coords: [number, number]) {
  const [lon, lat] = toLonLat(coords)
  form.longitude = Number(lon.toFixed(6))
  form.latitude = Number(lat.toFixed(6))
}

const isNextDisabled = computed(() => {
  if (step.value === 1) {
    if (!form.countryId)
      return true
    if (!form.city)
      return true
    if (form.latitude === '' || form.longitude === '')
      return true
    if (Number.isNaN(Number(form.latitude)) || Number.isNaN(Number(form.longitude)))
      return true
  }
  return false
})

async function submit() {
  isSubmitting.value = true
  try {
    let coverUrl: string | null = null

    if (form.coverFile && auth.user?.id) {
      await useRequest({
        key: 'destination-reviews:upload-cover',
        fn: db => db.files.uploadFile(form.coverFile!, auth.user!.id, 'review', 'cover'),
        onSuccess: (uploadedImage) => { coverUrl = uploadedImage.url },
        onError: ({ error }) => { toast.error(error.customMessage || 'Ошибка при загрузке обложки'); throw error },
      })
    }

    await useRequest({
      key: 'destination-reviews:create',
      fn: db => db.destinationReviews.create({
        type: form.type as any,
        countryId: form.countryId,
        city: form.city,
        coverUrl,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        content: form.content || null,
        metrics: form.metrics,
      }),
      onSuccess: () => {
        toast.success('Впечатление добавлено!')
        emit('success')
        visible.value = false

        step.value = 1
        form.countryId = ''
        form.city = ''
        form.coverFile = null
        form.content = ''
        form.latitude = ''
        form.longitude = ''
      },
      onError: ({ error }) => { toast.error(error.customMessage || 'Ошибка при сохранении впечатления') },
    })
  }
  finally {
    isSubmitting.value = false
  }
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
  <KitDialogWithClose v-model:visible="visible" title="Добавить впечатление" :max-width="550">
    <div class="form-wizard">
      <div class="stepper">
        <div class="step" :class="{ active: step >= 1, completed: step > 1 }">
          <div class="step-circle">
            1
          </div><span class="step-label">Место</span>
        </div>
        <div class="step-line" :class="{ active: step > 1 }" />

        <div class="step" :class="{ active: step >= 2, completed: step > 2 }">
          <div class="step-circle">
            2
          </div><span class="step-label">Фото</span>
        </div>
        <div class="step-line" :class="{ active: step > 2 }" />

        <div class="step" :class="{ active: step >= 3, completed: step > 3 }">
          <div class="step-circle">
            3
          </div><span class="step-label">Оценки</span>
        </div>
        <div class="step-line" :class="{ active: step > 3 }" />

        <div class="step" :class="{ active: step >= 4 }">
          <div class="step-circle">
            4
          </div><span class="step-label">Отзыв</span>
        </div>
      </div>

      <div v-if="step === 1" class="step-content">
        <KitSelectWithSearch
          v-model="form.countryId"
          :items="countryOptions"
          label="Страна"
          placeholder="Выберите страну"
        >
          <template #item="{ item }">
            <img v-if="(item as any).flagUrl" :src="(item as any).flagUrl" class="dropdown-flag" alt="">
            <span>{{ item.label }}</span>
          </template>
        </KitSelectWithSearch>

        <KitInput v-model="form.city" label="Город" placeholder="Например: Париж" />

        <div class="map-section">
          <label class="section-label">Точка на карте</label>
          <p class="section-hint">
            Кликните по карте или введите координаты вручную
          </p>
          <div class="coords-inputs">
            <KitInput v-model="form.latitude" type="number" step="any" placeholder="Широта" />
            <KitInput v-model="form.longitude" type="number" step="any" placeholder="Долгота" />
          </div>
          <div class="map-container">
            <KitMap :center="mapCenter" :zoom="2" height="280px" :markers="mapMarkers" :auto-pan="false" @click="handleMapClick" />
          </div>
        </div>
      </div>

      <div v-if="step === 2" class="step-content">
        <h4 class="step-title">
          Главное фото
        </h4>
        <p class="section-hint">
          Выберите обложку, которая лучше всего передаст атмосферу.
        </p>
        <KitFileInput v-model="form.coverFile" accept="image/*">
          Нажмите чтобы загрузить фото
        </KitFileInput>
      </div>

      <div v-if="step === 3" class="step-content">
        <h4 class="step-title">
          Оценка впечатлений
        </h4>
        <div class="metrics-grid">
          <KitSlider
            v-for="(val, key) in form.metrics" :key="key"
            v-model="form.metrics[key]"
            :label="metricLabels[key]"
            :min="1" :max="5" :step="1"
            :value-formatter="v => `${v} / 5`"
            :color="getSliderColor(val)"
          />
        </div>
      </div>

      <div v-if="step === 4" class="step-content step-content--textarea">
        <h4 class="step-title">
          Ваш комментарий
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

      <div class="wizard-actions">
        <KitBtn v-if="step > 1" variant="subtle" @click="step--">
          Назад
        </KitBtn>
        <div style="flex-grow: 1" />
        <KitBtn v-if="step < 4" :disabled="isNextDisabled" @click="step++">
          Далее
        </KitBtn>
        <KitBtn v-if="step === 4" color="primary" :loading="isSubmitting" @click="submit">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  margin-bottom: 24px;
  padding: 0 10px;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 2;
}
.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}
.step-label {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
  transition: color 0.3s ease;
}
.step.active .step-circle {
  border-color: var(--fg-accent-color);
  color: var(--fg-accent-color);
  background-color: var(--bg-primary-color);
}
.step.active .step-label {
  color: var(--fg-primary-color);
}
.step.completed .step-circle {
  background-color: var(--fg-accent-color);
  color: var(--bg-primary-color);
  border-color: var(--fg-accent-color);
}
.step-line {
  flex-grow: 1;
  height: 3px;
  background-color: var(--bg-tertiary-color);
  margin: 0 8px;
  margin-bottom: 22px;
  border-radius: 2px;
  transition: background-color 0.3s ease;
}
.step-line.active {
  background-color: var(--fg-accent-color);
}
.step-title {
  margin: 0 0 4px;
  color: var(--fg-primary-color);
  font-weight: 600;
  font-size: 1.1rem;
}
.section-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  display: block;
}
.section-hint {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  margin-top: 0;
  margin-bottom: 0;
}
.step-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 380px;
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

.map-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--r-m);
}
.coords-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 8px;
}
.map-container {
  border-radius: var(--r-s);
  overflow: hidden;
}

.metrics-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
</style>
