<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { Trip, TripImage, UpdateTripInput } from '~/shared/types/models/trip'
import { parseDate } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { TripImagePlacement, TripStatus, TripVisibility } from '~/shared/types/models/trip'

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
  'cities',
  'startDate',
  'endDate',
  'status',
  'budget',
  'currency',
  'tags',
  'imageUrl',
  'visibility',
]

const statusOptions = [
  { value: TripStatus.PLANNED, label: 'Запланировано' },
  { value: TripStatus.COMPLETED, label: 'Завершено' },
  { value: TripStatus.DRAFT, label: 'Черновик' },
]

const visibilityOptions: KitDropdownItem<TripVisibility>[] = [
  { value: TripVisibility.PRIVATE, label: 'Приватное', icon: 'mdi:lock-outline' },
  { value: TripVisibility.PUBLIC, label: 'Публичное', icon: 'mdi:earth' },
]

// --- Data Fetching ---
const availableCities = ref<KitDropdownItem<string>[]>([])
const availableTags = ref<KitDropdownItem<string>[]>([])
const coverImages = ref<TripImage[]>([])

const isLoadingCities = useRequestStatus(ETripEditInfoDialogKeys.FETCH_CITIES)
const isLoadingTags = useRequestStatus(ETripEditInfoDialogKeys.FETCH_TAGS)
const isLoadingImages = useRequestStatus(`${ETripEditInfoDialogKeys.FETCH_IMAGES}:${props.trip!.id}`)

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
      availableTags.value = tags.map(tag => ({ value: tag, label: tag }))
    },
  })

  useRequest({
    key: `${ETripEditInfoDialogKeys.FETCH_IMAGES}:${props.trip.id}`,
    fn: db => db.files.listImageByTrip(props.trip!.id, TripImagePlacement.ROUTE),
    onSuccess: (images) => {
      coverImages.value = images
    },
  })
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
      cities: props.trip.cities ?? [],
      startDate: props.trip.startDate,
      endDate: props.trip.endDate,
      status: props.trip.status,
      budget: props.trip.budget,
      currency: props.trip.currency,
      tags: props.trip.tags ?? [],
      imageUrl: props.trip.imageUrl,
      visibility: props.trip.visibility,
    }
    fetchDialogData()
  }
}, { immediate: true })
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Редактировать путешествие"
    icon="mdi:pencil-outline"
    :max-width="600"
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="editableTrip" class="edit-trip-form">
      <KitInput v-model="editableTrip.title" label="Название" />
      <KitInput v-model="editableTrip.description" type="textarea" label="Описание" />

      <KitSelectWithSearch
        v-model="editableTrip.cities!"
        :items="availableCities"
        :loading="isLoadingCities"
        label="Города"
        placeholder="Добавьте город"
        multiple
        creatable
      />

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

      <KitSelectWithSearch
        v-model="editableTrip.visibility!"
        :items="visibilityOptions"
        label="Видимость"
        :clearable="false"
      />

      <div class="budget-fields">
        <KitInput v-model.number="editableTrip.budget" type="number" label="Бюджет" placeholder="10000" />
        <KitInput v-model="editableTrip.currency" label="Валюта" placeholder="RUB" />
      </div>

      <KitSelectWithSearch
        v-model="editableTrip.tags!"
        :items="availableTags"
        :loading="isLoadingTags"
        label="Теги"
        placeholder="Добавьте тег"
        multiple
        creatable
      />

      <div class="image-selector">
        <label>Обложка путешествия</label>
        <div v-if="isLoadingImages" class="loading-placeholder">
          Загрузка изображений...
        </div>
        <div v-else-if="coverImages.length > 0" class="image-grid">
          <div
            class="image-option"
            :class="{ selected: !editableTrip.imageUrl }"
            @click="editableTrip.imageUrl = null"
          >
            <div class="no-image-placeholder">
              <Icon icon="mdi:image-off-outline" />
            </div>
          </div>
          <div
            v-for="image in coverImages"
            :key="image.id"
            class="image-option"
            :class="{ selected: editableTrip.imageUrl === image.url }"
            @click="editableTrip.imageUrl = image.url"
          >
            <KitImage :src="image.variants?.small || image.url" />
          </div>
        </div>
        <p v-else class="no-images-text">
          Добавьте фотографии в путешествие, чтобы выбрать обложку.
        </p>
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
</template>

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

.image-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  background-color: var(--bg-tertiary-color);
  padding: 8px;
  border-radius: var(--r-m);
}

.image-option {
  height: 80px;
  border-radius: var(--r-s);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s ease;
  position: relative;

  &.selected {
    border-color: var(--fg-accent-color);
  }
}

.no-image-placeholder {
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
</style>
