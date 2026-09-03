<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { KitRadioOption } from '~/components/01.kit/kit-radio-group'
import type { Trip, TripMedia, UpdateTripInput } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitRadioGroup } from '~/components/01.kit/kit-radio-group'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { TripMediaPlacement, TripStatus, TripVisibility } from '~/shared/types/models/trip'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', value: UpdateTripInput): void
}>()

enum ETripEditInfoDialogKeys {
  FETCH_CITIES = 'trip-edit-dialog:fetch-cities',
  FETCH_TAGS = 'trip-edit-dialog:fetch-tags',
  FETCH_IMAGES = 'trip-edit-dialog:fetch-images',
}

interface Props {
  visible: boolean
  trip: Trip | null
}

const fieldsToCompare: (keyof UpdateTripInput)[] = [
  'title',
  'description',
  'descriptionShort',
  'cities',
  'startDate',
  'endDate',
  'status',
  'budget',
  'currency',
  'tags',
  'imageUrl',
  'visibility',
  'weatherData',
]

const statusOptions = [
  { value: TripStatus.PLANNED, label: 'Запланировано' },
  { value: TripStatus.COMPLETED, label: 'Завершено' },
  { value: TripStatus.DRAFT, label: 'Черновик' },
]

// Обновленные опции видимости для нового компонента KitRadioGroup
const visibilityOptions: KitRadioOption<TripVisibility>[] = [
  {
    value: TripVisibility.PRIVATE,
    label: 'Приватное',
    description: 'Путешествие видите только вы и приглашенные участники',
    icon: 'mdi:lock-outline',
  },
  {
    value: TripVisibility.PUBLIC,
    label: 'Публичное',
    description: 'Доступно всем, у кого есть ссылка на путешествие',
    icon: 'mdi:earth',
  },
]

const availableCities = ref<KitDropdownItem<string>[]>([])
const availableTags = ref<KitDropdownItem<string>[]>([])
const coverImages = ref<TripMedia[]>([])

const isLoadingCities = useRequestStatus(ETripEditInfoDialogKeys.FETCH_CITIES)
const isLoadingTags = useRequestStatus(ETripEditInfoDialogKeys.FETCH_TAGS)
const isLoadingImages = useRequestStatus(`${ETripEditInfoDialogKeys.FETCH_IMAGES}:${props.trip?.id}`)

const isCoverDialogOpen = ref(false)
const hasFetchedImages = ref(false)

function formatTag(tag: string): string {
  if (!tag)
    return ''
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
}

async function fetchDialogData() {
  if (!props.trip)
    return

  useRequest({
    key: ETripEditInfoDialogKeys.FETCH_CITIES,
    force: false,
    fn: db => db.trips.getUniqueCities(),
    onSuccess: (cities) => {
      availableCities.value = cities.map(city => ({ value: city, label: city }))
    },
  })

  useRequest({
    key: ETripEditInfoDialogKeys.FETCH_TAGS,
    force: false,
    fn: db => db.trips.getUniqueTags({}),
    onSuccess: (tags) => {
      availableTags.value = tags.map(tag => ({
        value: tag.toLowerCase(),
        label: formatTag(tag),
      }))
    },
  })
}

function openCoverDialog() {
  isCoverDialogOpen.value = true

  if (!hasFetchedImages.value && props.trip) {
    useRequest({
      key: `${ETripEditInfoDialogKeys.FETCH_IMAGES}:${props.trip.id}`,
      fn: db => db.files.listImageByTrip(props.trip!.id, TripMediaPlacement.ROUTE),
      onSuccess: (images) => {
        coverImages.value = images
        hasFetchedImages.value = true
      },
    })
  }
}

function selectCover(url: string | null) {
  // eslint-disable-next-line ts/no-use-before-define
  editableTrip.value.imageUrl = url
  isCoverDialogOpen.value = false
}

const editableTrip = ref<Partial<UpdateTripInput>>({})

function toYyyyMmDd(date: string | Date | undefined) {
  if (!date)
    return new Date().toISOString().split('T')[0]

  return new Date(date).toISOString().split('T')[0]
}

const isChanged = computed(() => {
  if (!props.trip)
    return false

  for (const key of fieldsToCompare) {
    if (JSON.stringify(props.trip[key as keyof Trip]) !== JSON.stringify(editableTrip.value[key]))
      return true
  }

  return false
})

const startDate = computed({
  get: () => parseDate(toYyyyMmDd(editableTrip.value.startDate)),
  set: (date: CalendarDate | null) => {
    if (date)
      editableTrip.value.startDate = date.toDate('UTC').toISOString()
  },
})

const endDate = computed({
  get: () => parseDate(toYyyyMmDd(editableTrip.value.endDate)),
  set: (date: CalendarDate | null) => {
    if (date)
      editableTrip.value.endDate = date.toDate('UTC').toISOString()
  },
})

const descriptionShortModel = computed({
  get: () => editableTrip.value.descriptionShort ?? '',
  set: (val: string) => {
    editableTrip.value.descriptionShort = val
  },
})

const descriptionModel = computed({
  get: () => editableTrip.value.description ?? '',
  set: (val: string) => {
    editableTrip.value.description = val
  },
})

const tagsModel = computed({
  get: () => editableTrip.value.tags ?? [],
  set: (val: string[]) => {
    editableTrip.value.tags = val.map(t => t.toLowerCase())
  },
})

function handleSave() {
  const updatedFields: Partial<UpdateTripInput> = {}
  if (!props.trip)
    return

  for (const fieldKey of fieldsToCompare) {
    const originalValue = props.trip[fieldKey as keyof Trip]
    const updatedValue = editableTrip.value[fieldKey]

    if (JSON.stringify(originalValue) !== JSON.stringify(updatedValue))
      (updatedFields as any)[fieldKey] = updatedValue
  }

  emit('save', updatedFields)
  emit('update:visible', false)
}

watch(() => props.visible, (isVisible) => {
  if (isVisible && props.trip) {
    editableTrip.value = {
      title: props.trip.title,
      description: props.trip.description,
      descriptionShort: props.trip.descriptionShort,
      cities: props.trip.cities ?? [],
      startDate: props.trip.startDate,
      endDate: props.trip.endDate,
      status: props.trip.status,
      budget: props.trip.budget,
      currency: props.trip.currency,
      tags: props.trip.tags?.map(t => t.toLowerCase()) ?? [],
      imageUrl: props.trip.imageUrl,
      visibility: props.trip.visibility,
      weatherData: props.trip.weatherData ? { ...props.trip.weatherData } : {},
    }
    hasFetchedImages.value = false
    fetchDialogData()
  }
}, { immediate: true })

const isGeneratingWeather = ref(false)

const hasWeatherDataForAllCities = computed(() => {
  const cities = editableTrip.value.cities || []
  if (cities.length === 0)
    return false
  const wData = editableTrip.value.weatherData as any
  if (!wData)
    return false
  return cities.every((c: string) => !!wData[c])
})

async function handleGenerateWeatherInDialog() {
  if (!props.trip?.id || !editableTrip.value.cities?.length)
    return

  isGeneratingWeather.value = true
  try {
    const res = await useRequest({
      key: `trip-edit:generate-weather:${props.trip.id}`,
      fn: db => db.trips.generateWeather({
        tripId: props.trip!.id,
        forceRefresh: false,
      }),
    })
    if (res?.weatherData) {
      editableTrip.value.weatherData = res.weatherData
      useToast().success('Климатический контекст подготовлен!')
    }
  }
  catch (e: any) {
    console.error('Failed to generate weather in dialog:', e)
    useToast().error('Не удалось получить данные о погоде.')
  }
  finally {
    isGeneratingWeather.value = false
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Редактировать путешествие"
    icon="mdi:pencil-outline"
    :max-width="600"
    :content-class="isCoverDialogOpen ? 'edit-trip-bg-state' : ''"
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="editableTrip" class="edit-trip-form">
      <KitInput v-model="editableTrip.title" label="Название" />
      <div class="field-group">
        <label class="field-label">Краткое описание</label>
        <p class="field-hint">
          Отображается сразу — лаконичная суть путешествия.
        </p>
        <div class="md-field-editor">
          <KitInlineMdEditorWrapper
            v-model="descriptionShortModel"
            placeholder="Краткое описание..."
          />
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">Подробное описание</label>
        <p class="field-hint">
          Раскрывается по кнопке «Подробнее» — детали, история, впечатления.
        </p>
        <div class="md-field-editor">
          <KitInlineMdEditorWrapper
            v-model="descriptionModel"
            placeholder="Подробное описание..."
          />
        </div>
      </div>
      <KitSelectWithSearch
        v-model="editableTrip.cities!"
        :items="availableCities"
        :loading="isLoadingCities"
        label="Города"
        placeholder="Добавьте город"
        multiple
        creatable
      />

      <!-- Климатический контекст городов во время редактирования/планирования -->
      <div v-if="editableTrip.cities && editableTrip.cities.length > 0" class="weather-preview-box">
        <div class="weather-preview-header">
          <div class="header-left">
            <Icon icon="mdi:weather-partly-cloudy" class="weather-icon" />
            <span class="preview-title">Климатический контекст городов</span>
          </div>
          <KitBtn
            v-if="props.trip?.id"
            size="sm"
            variant="tonal"
            color="primary"
            :loading="isGeneratingWeather"
            @click="handleGenerateWeatherInDialog"
          >
            <Icon icon="mdi:creation" />
            <span>{{ hasWeatherDataForAllCities ? 'Обновить данные' : 'Сгенерировать сводку' }}</span>
          </KitBtn>
        </div>

        <div class="weather-cities-status">
          <div
            v-for="city in editableTrip.cities"
            :key="city"
            class="city-weather-badge"
            :class="{ 'is-ready': !!editableTrip.weatherData?.[city] }"
          >
            <span class="city-name">{{ city }}</span>
            <span v-if="editableTrip.weatherData?.[city]" class="city-info">
              {{ editableTrip.weatherData[city].tempAverage !== null ? `${editableTrip.weatherData[city].tempAverage > 0 ? '+' : ''}${editableTrip.weatherData[city].tempAverage}°` : '' }}
              <template v-if="editableTrip.weatherData[city].windSpeed">, {{ editableTrip.weatherData[city].windSpeed }} км/ч</template>
            </span>
            <span v-else class="city-missing">нет данных</span>
          </div>
        </div>
      </div>

      <div class="date-pickers">
        <div class="date-picker">
          <label>Дата начала</label>
          <CalendarPopover v-model="startDate">
            <template #trigger>
              <button class="date-trigger">
                {{ startDate?.toString() }}
              </button>
            </template>
          </CalendarPopover>
        </div>
        <div class="date-picker">
          <label>Дата окончания</label>
          <CalendarPopover v-model="endDate">
            <template #trigger>
              <button class="date-trigger">
                {{ endDate?.toString() }}
              </button>
            </template>
          </CalendarPopover>
        </div>
      </div>

      <KitSelectWithSearch
        v-model="editableTrip.status!"
        :items="statusOptions"
        label="Статус"
      />

      <!-- Использование нового KitRadioGroup -->
      <div class="field-group">
        <label class="field-label">Видимость</label>
        <KitRadioGroup
          v-model="editableTrip.visibility!"
          :options="visibilityOptions"
        />
      </div>

      <div class="budget-fields">
        <KitInput v-model.number="editableTrip.budget" type="number" label="Бюджет" placeholder="10000" />
        <KitInput v-model="editableTrip.currency" label="Валюта" placeholder="RUB" />
      </div>

      <KitSelectWithSearch
        v-model="tagsModel"
        :items="availableTags"
        :loading="isLoadingTags"
        label="Теги"
        placeholder="Добавьте тег"
        multiple
        creatable
      />

      <div class="field-group">
        <label class="field-label">Обложка путешествия</label>
        <div class="current-cover-preview">
          <div v-if="editableTrip.imageUrl" class="cover-image-wrapper">
            <KitImage :src="editableTrip.imageUrl" object-fit="cover" />
          </div>
          <div v-else class="no-cover-placeholder">
            <Icon icon="mdi:image-outline" class="placeholder-icon" />
            <span>Обложка не выбрана</span>
          </div>
          <div class="cover-actions">
            <KitBtn variant="outlined" color="secondary" size="sm" @click="openCoverDialog">
              <Icon icon="mdi:image-edit-outline" />
              {{ editableTrip.imageUrl ? 'Изменить обложку' : 'Выбрать обложку' }}
            </KitBtn>
            <KitBtn v-if="editableTrip.imageUrl" variant="text" color="secondary" size="sm" @click="editableTrip.imageUrl = null">
              Удалить
            </KitBtn>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <KitBtn variant="outlined" color="secondary" @click="$emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn :disabled="!isChanged" @click="handleSave">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>

  <KitDialogWithClose
    :visible="isCoverDialogOpen"
    title="Выбор обложки"
    icon="mdi:image-multiple-outline"
    :max-width="500"
    @update:visible="isCoverDialogOpen = $event"
  >
    <div v-if="isLoadingImages" class="loading-placeholder">
      Загрузка изображений...
    </div>
    <div v-else-if="coverImages.length > 0" class="image-grid">
      <div
        class="image-option"
        :class="{ selected: !editableTrip.imageUrl }"
        @click="selectCover(null)"
      >
        <div class="no-image-placeholder-grid">
          <Icon icon="mdi:image-off-outline" />
        </div>
      </div>
      <div
        v-for="image in coverImages"
        :key="image.id"
        class="image-option"
        :class="{ selected: editableTrip.imageUrl === image.url }"
        @click="selectCover(image.url)"
      >
        <KitImage :src="image.variants?.small || image.url" />
      </div>
    </div>
    <p v-else class="no-images-text">
      Добавьте фотографии в путешествие, чтобы выбрать обложку.
    </p>
  </KitDialogWithClose>
</template>

<style lang="scss">
.edit-trip-bg-state {
  opacity: 0.7 !important;
  filter: blur(2px) !important;
  pointer-events: none !important;
  user-select: none !important;
}
</style>

<style lang="scss" scoped>
.edit-trip-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.date-pickers,
.budget-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.date-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }

  .field-hint {
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
    margin: 0 0 2px;
  }
}

.md-field-editor {
  min-height: 80px;
  padding: 8px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  transition: border-color 0.2s ease;
  cursor: text;

  &:focus-within {
    border-color: var(--border-focus-color);
  }
}

.date-trigger {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}

.current-cover-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 12px;
  border-radius: var(--r-s);

  .cover-image-wrapper {
    width: 140px;
    height: 80px;
    border-radius: var(--r-xs);
    overflow: hidden;
    flex-shrink: 0;
  }

  .no-cover-placeholder {
    width: 140px;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-tertiary-color);
    border-radius: var(--r-xs);
    flex-shrink: 0;

    .placeholder-icon {
      font-size: 1.5rem;
    }

    span {
      font-size: 0.75rem;
      text-align: center;
    }
  }

  .cover-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: flex-start;

    .cover-image-wrapper,
    .no-cover-placeholder {
      width: 100%;
      height: 120px;
    }

    .cover-actions {
      width: 100%;
      flex-direction: row;
    }
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  background-color: var(--bg-tertiary-color);
  padding: 8px;
  border-radius: var(--r-m);
}

.image-option {
  height: 90px;
  border-radius: var(--r-s);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background-color: var(--bg-secondary-color);
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 2px var(--bg-primary-color) inset;
  }
}

.no-image-placeholder-grid {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  color: var(--fg-tertiary-color);
  font-size: 2rem;
}

.no-images-text,
.loading-placeholder {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  text-align: center;
  padding: 16px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
}

.weather-preview-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-tertiary-color);
  padding: 12px 14px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.weather-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-primary-color);

    .weather-icon {
      font-size: 1.1rem;
      color: var(--fg-accent-color);
    }
  }
}

.weather-cities-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.city-weather-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 4px 10px;
  border-radius: var(--r-s);
  font-size: 0.775rem;

  .city-name {
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .city-info {
    color: var(--fg-accent-color);
    font-weight: 500;
  }

  .city-missing {
    color: var(--fg-secondary-color);
    opacity: 0.7;
    font-style: italic;
  }

  &.is-ready {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.05);
  }
}
</style>
