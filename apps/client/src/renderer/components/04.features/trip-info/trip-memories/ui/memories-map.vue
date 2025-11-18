<script setup lang="ts">
import type { MapMarker } from '~/components/01.kit/kit-map'
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitMap } from '~/components/01.kit/kit-map'

interface Props {
  memories: Memory[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const mapMarkers = computed<MapMarker[]>(() => {
  return props.memories.map((memory) => {
    // We can be sure that image, latitude and longitude exist because of the store getter
    const image = memory.image!

    return {
      id: memory.id,
      coords: {
        lon: image.longitude!,
        lat: image.latitude!,
      },
      imageUrl: image.variants?.small || image.url,
      payload: memory,
    }
  })
})

const mapCenter = computed((): [number, number] => {
  if (mapMarkers.value.length > 0) {
    const avgLon = mapMarkers.value.reduce((sum, m) => sum + m.coords.lon, 0) / mapMarkers.value.length
    const avgLat = mapMarkers.value.reduce((sum, m) => sum + m.coords.lat, 0) / mapMarkers.value.length
    return [avgLon, avgLat]
  }

  return [0, 0] // Default fallback
})
</script>

<template>
  <div class="memories-map-view">
    <div class="map-header">
      <h4><Icon icon="mdi:map-marker-outline" /> Фотографии на карте</h4>
      <KitBtn
        variant="text"
        color="secondary"
        icon="mdi:close"
        aria-label="Закрыть карту"
        @click="emit('close')"
      />
    </div>
    <div class="map-container">
      <ClientOnly>
        <KitMap
          v-if="memories.length > 0"
          :markers="mapMarkers"
          :center="mapCenter"
          height="600px"
          :auto-pan="false"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-map-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--fg-primary-color);
  }
}

.map-container {
  width: 100%;
  height: 600px;
  border-radius: var(--r-m);
  overflow: hidden;
}
</style>
