<script setup lang="ts">
import type { MapMarker } from '~/components/01.kit/kit-map'
import type { TripCityRef } from '~/shared/types/models/geo-place'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitMap } from '~/components/01.kit/kit-map'

interface Props {
  visible: boolean
  cityRefs?: TripCityRef[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const selectedCity = ref<string | null>(null)
const selectedCityCoords = ref<{ lat: number, lon: number } | null>(null)
const isMapViewerVisible = ref(false)

const cityEntries = computed(() => [...(props.cityRefs ?? [])]
  .sort((a, b) => a.position - b.position)
  .map(place => ({
    id: place.id,
    name: place.name,
    label: `${place.name} · ${place.countryName}`,
    coordinates: { lat: place.latitude, lon: place.longitude },
  })))

const center = computed((): [number, number] => {
  const lon = selectedCityCoords.value?.lon ?? 37.61
  const lat = selectedCityCoords.value?.lat ?? 55.75

  return [lon, lat]
})

const markers = computed<MapMarker[]>(() => {
  if (!selectedCityCoords.value)
    return []

  return [
    {
      id: 'selected-city',
      coords: selectedCityCoords.value,
    },
  ]
})

function showMapForCity(city: (typeof cityEntries.value)[number]) {
  if (!city.name)
    return

  selectedCity.value = city.label
  selectedCityCoords.value = {
    lat: city.coordinates.lat,
    lon: city.coordinates.lon,
  }
  isMapViewerVisible.value = true
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
        <li v-for="city in cityEntries" :key="city.id">
          <button class="city-item-btn" @click="showMapForCity(city)">
            <Icon icon="mdi:map-marker-outline" />
            <span>{{ city.label }}</span>
            <Icon icon="mdi:chevron-right" class="chevron" />
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
          :center="center"
          :zoom="11"
          :markers="markers"
          height="60vh"
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
