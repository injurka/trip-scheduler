<script setup lang="ts">
import type Map from 'ol/Map'
import type { LocationCoords } from '../../models/types'
import { Feature } from 'ol'
import { Point } from 'ol/geom'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Icon as OlIcon, Style } from 'ol/style'
import { computed, nextTick, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'update:visible'])

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

interface Props {
  modelValue: LocationCoords | undefined
  label: string
  readonly: boolean
  visible: boolean
}
const tempCoords = ref<LocationCoords>({ lat: 0, lon: 0 })
const mapInstance = ref<Map | null>(null)
const markerSource = new VectorSource()
const markerLayer = new VectorLayer({ source: markerSource, zIndex: 10 })
const searchQuery = ref('')
const isSearching = ref(false)

const center = computed((): [number, number] => {
  return [tempCoords.value.lon, tempCoords.value.lat]
})

function updateMarkerPosition() {
  if (!mapInstance.value)
    return
  markerSource.clear()
  const marker = new Feature({
    geometry: new Point([tempCoords.value.lon, tempCoords.value.lat]),
  })
  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#E74C3C"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`
  marker.setStyle(
    new Style({
      image: new OlIcon({
        src: `data:image/svg+xml;base64,${btoa(svg)}`,
        scale: 1.5,
        anchor: [0.5, 1],
      }),
    }),
  )
  markerSource.addFeature(marker)
}

function onMapReady(map: Map) {
  mapInstance.value = map
  mapInstance.value.addLayer(markerLayer)
  updateMarkerPosition()
}

function onMapClick(coords: [number, number]) {
  tempCoords.value.lon = coords[0]
  tempCoords.value.lat = coords[1]
}

async function handleSearch() {
  if (!searchQuery.value.trim() || !mapInstance.value)
    return

  isSearching.value = true
  const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(searchQuery.value)}&format=json&limit=1&accept-language=ru`

  try {
    const response = await fetch(url)
    const data = await response.json()
    if (data && data.length > 0) {
      const result = data[0]
      const lon = Number.parseFloat(result.lon)
      const lat = Number.parseFloat(result.lat)
      tempCoords.value = { lon, lat }
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

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    tempCoords.value = { ...(props.modelValue || { lat: 55.75, lon: 37.61 }) }
    searchQuery.value = ''
    nextTick(() => {
      if (mapInstance.value) {
        mapInstance.value.getView().setCenter([tempCoords.value.lon, tempCoords.value.lat])
        updateMarkerPosition()
      }
    })
  }
})

watch(tempCoords, () => {
  updateMarkerPosition()
}, { deep: true })

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
          :zoom="10"
          @map-ready="onMapReady"
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

  :deep(.ol-viewport) {
    min-height: 500px;
  }
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
