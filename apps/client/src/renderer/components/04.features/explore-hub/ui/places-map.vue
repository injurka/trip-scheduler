<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Place } from '~/shared/types/models/place'
import * as maplibregl from 'maplibre-gl'
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { KitMap } from '~/components/01.kit/kit-map'
import { createMarkerElement } from '~/shared/services/geo'

const props = defineProps<{
  places: Place[]
  center: [number, number]
}>()

const mapInstance = shallowRef<MapLibreMap | null>(null)
const markersMap = new Map<string, maplibregl.Marker>()
const selectedPlace = ref<Place | null>(null)

function clearMarkers() {
  markersMap.forEach(m => m.remove())
  markersMap.clear()
}

function updateMarkers(places: Place[]) {
  clearMarkers()
  const map = mapInstance.value
  if (!map || !places || places.length === 0)
    return

  places.forEach((place) => {
    const el = createMarkerElement({ color: '#344079', scale: 1.2 })

    const popupContent = `
      <div style="font-family: inherit; padding: 2px;">
        <h4 style="margin: 0 0 4px; font-size: 0.95rem; font-weight: 600;">${place.name}</h4>
        ${place.description ? `<p style="margin: 0; font-size: 0.85rem; color: #666;">${place.description}</p>` : ''}
      </div>
    `
    const popup = new maplibregl.Popup({ offset: 28, closeButton: true })
      .setHTML(popupContent)

    const marker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat([place.coordinates.lon, place.coordinates.lat])
      .setPopup(popup)
      .addTo(map)

    el.addEventListener('click', () => {
      selectedPlace.value = place
    })

    const key = place.id || `${place.coordinates.lon}_${place.coordinates.lat}`
    markersMap.set(key, marker)
  })
}

function onMapReady(map: MapLibreMap) {
  mapInstance.value = map

  map.on('click', () => {
    selectedPlace.value = null
  })

  updateMarkers(props.places)
}

watch(() => props.places, (newPlaces) => {
  if (mapInstance.value) {
    updateMarkers(newPlaces)
  }
}, { deep: true })

onMounted(() => {
  watch(() => props.places, async () => {
    await nextTick()
    mapInstance.value?.resize()
  })
})

onUnmounted(() => {
  clearMarkers()
})
</script>

<template>
  <div class="places-map-container">
    <KitMap :center="center" :zoom="10" @map-ready="onMapReady" />
    <div v-if="selectedPlace" class="place-popup-bottom">
      <div class="popup-content">
        <h4>{{ selectedPlace.name }}</h4>
        <p>{{ selectedPlace.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.places-map-container {
  width: 100%;
  height: 100%;
  min-height: 600px;
  border-radius: var(--r-l);
  overflow: hidden;
  position: relative;

  :deep(.kit-map-wrapper) {
    height: 600px !important;
  }
}

.place-popup-bottom {
  background-color: var(--bg-secondary-color);
  padding: 1rem;
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-l);
  width: 280px;
  bottom: 16px;
  left: 16px;
  position: absolute;
  z-index: 10;
  transition: opacity 0.2s;
}

.popup-content {
  h4 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}
</style>
