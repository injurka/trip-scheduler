<script setup lang="ts">
import type Map from 'ol/Map'
import { Icon } from '@iconify/vue'
import { Feature } from 'ol'
import { Point } from 'ol/geom'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitMap } from '~/components/01.kit/kit-map'

import { createMarkerStyle, nominatimService, toMapCoord } from '~/shared/services/geo'

interface Props {
  visible: boolean
  cities: string[]
}
defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const selectedCity = ref<string | null>(null)
const selectedCityCoords = ref<{ lat: number, lon: number } | null>(null)
const isMapViewerVisible = ref(false)
const isLoadingCoords = ref(false)

const mapInstance = ref<Map | null>(null)
const markerSource = new VectorSource()
const markerLayer = new VectorLayer({ source: markerSource, zIndex: 10 })

const centerForMapProjected = computed((): [number, number] => {
  const lon = selectedCityCoords.value?.lon ?? 37.61 // Moscow lon
  const lat = selectedCityCoords.value?.lat ?? 55.75 // Moscow lat

  return fromLonLat([lon, lat]) as [number, number]
})

function updateMarkerPosition() {
  if (!mapInstance.value || !selectedCityCoords.value)
    return

  markerSource.clear()
  const marker = new Feature({
    geometry: new Point(toMapCoord([selectedCityCoords.value.lon, selectedCityCoords.value.lat])),
  })
  marker.setStyle(createMarkerStyle({ color: '#3498db' }))
  markerSource.addFeature(marker)
}

function onMapReady(map: Map) {
  mapInstance.value = map
  mapInstance.value.addLayer(markerLayer)
  updateMarkerPosition()
}

watch(isMapViewerVisible, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      if (mapInstance.value) {
        mapInstance.value.updateSize()
        updateMarkerPosition()
        mapInstance.value.getView().setCenter(centerForMapProjected.value)
      }
    })
  }
})

async function showMapForCity(city: string) {
  if (!city)
    return

  isLoadingCoords.value = true
  selectedCity.value = city
  selectedCityCoords.value = null

  try {
    const result = await nominatimService.searchSingle(city)
    if (result) {
      selectedCityCoords.value = {
        lat: result.lat,
        lon: result.lon,
      }
      isMapViewerVisible.value = true
    }
    else {
      console.error(`Координаты для города "${city}" не найдены.`)
    }
  }
  catch (error) {
    console.error('Ошибка при получении координат:', error)
  }
  finally {
    isLoadingCoords.value = false
  }
}
</script>

<template>
  <div>
    <KitDialogWithClose
      :visible="visible"
      title="Города путешествия"
      icon="mdi:city-variant-outline"
      :max-width="400"
      @update:visible="emit('update:visible', $event)"
    >
      <ul class="simple-list">
        <li v-for="city in cities" :key="city">
          <button class="city-item-btn" @click="showMapForCity(city)">
            <Icon icon="mdi:map-marker-outline" />
            <span>{{ city }}</span>
            <Icon v-if="isLoadingCoords && selectedCity === city" icon="mdi:loading" class="spinner" />
            <Icon v-else icon="mdi:chevron-right" class="chevron" />
          </button>
        </li>
      </ul>
    </KitDialogWithClose>

    <KitDialogWithClose
      v-model:visible="isMapViewerVisible"
      :title="selectedCity || 'Карта'"
      icon="mdi:map-marker"
      :max-width="800"
    >
      <div class="location-viewer-content">
        <KitMap
          :center="centerForMapProjected"
          :zoom="11"
          height="60vh"
          @map-ready="onMapReady"
        />
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.simple-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  li {
    width: 100%;
  }
}

.city-item-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1rem;
  padding: 0.75rem;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  width: 100%;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--fg-primary-color);
  font-family: inherit;
  text-align: left;

  &:hover {
    border-color: var(--border-accent-color);
    background-color: var(--bg-hover-color);
  }

  .chevron {
    margin-left: auto;
    color: var(--fg-tertiary-color);
  }

  .spinner {
    margin-left: auto;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
  }
}

.location-viewer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--r-m);
  overflow: hidden;
  margin-top: 1rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
