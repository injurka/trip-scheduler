<script setup lang="ts">
import type { LocationCoords } from '../../models/types'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { useToast } from '~/shared/composables/use-toast'
import { nominatimService } from '~/shared/services/geo'

interface Props {
  modelValue: LocationCoords | undefined
  label: string
  readonly: boolean
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue', 'update:visible'])

const tempCoords = ref<LocationCoords>({ lat: 55.75, lon: 37.61 })
const searchQuery = ref('')
const isSearching = ref(false)

const center = computed((): [number, number] => {
  return [tempCoords.value.lon, tempCoords.value.lat]
})

const markers = computed<MapMarker[]>(() => {
  return [
    {
      id: 'picked-location',
      coords: tempCoords.value,
    },
  ]
})

function onMapClick(coords: [number, number]) {
  tempCoords.value.lon = Number(coords[0].toFixed(6))
  tempCoords.value.lat = Number(coords[1].toFixed(6))
}

async function handleSearch() {
  if (!searchQuery.value.trim())
    return

  isSearching.value = true
  try {
    const result = await nominatimService.searchSingle(searchQuery.value)
    if (result) {
      tempCoords.value = {
        lon: Number(result.lon.toFixed(6)),
        lat: Number(result.lat.toFixed(6)),
      }
    }
    else {
      useToast().error('Местоположение не найдено.')
    }
  }
  catch (error) {
    console.error('Error searching location:', error)
    useToast().error('Ошибка при поиске.')
  }
  finally {
    isSearching.value = false
  }
}

watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen) {
      tempCoords.value = { ...(props.modelValue || { lat: 55.75, lon: 37.61 }) }
      searchQuery.value = ''
    }
  },
  { immediate: true },
)

function saveLocation() {
  const lat = Number(tempCoords.value.lat)
  const lon = Number(tempCoords.value.lon)
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    emit('update:modelValue', { lat, lon })
    closeModal()
  }
  else {
    useToast().error('Неверный формат координат.')
  }
}

function closeModal() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="label"
    icon="mdi:map-marker"
    :max-width="800"
    content-class="location-dialog-content"
    @update:visible="closeModal"
  >
    <div class="location-picker-content">
      <div class="map-controls">
        <div class="search-bar">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск места..."
            icon="mdi:magnify"
            :disabled="isSearching"
            @keydown.enter="handleSearch"
          />
          <KitBtn :loading="isSearching" @click="handleSearch">
            Найти
          </KitBtn>
        </div>
        <div class="coords-inputs">
          <KitInput v-model.number="tempCoords.lat" label="Широта (Lat)" type="number" step="0.00001" />
          <KitInput v-model.number="tempCoords.lon" label="Долгота (Lon)" type="number" step="0.00001" />
        </div>
      </div>

      <div class="map-wrapper">
        <KitMap
          :center="center"
          :zoom="12"
          :markers="markers"
          @click="onMapClick"
        />
      </div>

      <div class="dialog-actions">
        <KitBtn variant="outlined" @click="closeModal">
          Отмена
        </KitBtn>
        <KitBtn @click="saveLocation">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.location-dialog-content {
  height: 80vh;
  display: flex;
  flex-direction: column;
}

.location-picker-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.map-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
}

.coords-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.map-wrapper {
  flex-grow: 1;
  min-height: 300px;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
}
</style>
