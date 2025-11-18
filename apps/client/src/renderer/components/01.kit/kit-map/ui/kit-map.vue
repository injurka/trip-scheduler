<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import type { MapMarker } from '../models/types'
import { useFullscreen } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useKitMap } from '../composables/use-kit-map'
import KitMapControls from './kit-map-controls.vue'

import 'ol/ol.css'

interface Props {
  center: [number, number]
  zoom?: number
  height?: string
  markers?: MapMarker[]
  autoPan?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 12,
  height: '100%',
  markers: () => [],
  autoPan: true,
})

const emit = defineEmits<{
  (e: 'mapReady', map: OlMap): void
  (e: 'click', coords: [number, number]): void
}>()

const mapWrapperRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const { mapInstance, isMapReady, initMap, zoomIn, zoomOut, updateMarkers, fitViewToMarkers } = useKitMap()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(mapWrapperRef)

onMounted(async () => {
  if (mapWrapperRef.value && popupRef.value) {
    await initMap(mapWrapperRef.value, popupRef.value, {
      center: props.center,
      zoom: props.zoom,
      autoPan: props.autoPan,
    })

    if (mapInstance.value) {
      mapInstance.value.on('click', (event) => {
        emit('click', event.coordinate as [number, number])
      })
      emit('mapReady', mapInstance.value)

      if (props.markers.length > 0) {
        updateMarkers(props.markers)
        fitViewToMarkers()
      }
    }
  }
})

watch(() => props.center, (newCenter) => {
  mapInstance.value?.getView().animate({ center: newCenter, duration: 500 })
})

watch(() => props.markers, (newMarkers) => {
  if (isMapReady.value) {
    updateMarkers(newMarkers)
    fitViewToMarkers()
  }
}, { deep: true })
</script>

<template>
  <div ref="mapWrapperRef" class="kit-map-wrapper" :style="{ height }">
    <div v-if="!isMapReady" class="loading-overlay">
      <span>Инициализация карты...</span>
    </div>

    <slot />

    <div ref="popupRef" class="ol-popup-placeholder" />

    <div class="controls-container">
      <KitMapControls :map-instance="mapInstance" @zoom-in="zoomIn" @zoom-out="zoomOut" />
      <KitBtn
        class="fullscreen-btn"
        variant="outlined"
        color="secondary"
        :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
        aria-label="Во весь экран"
        @click="toggleFullscreen"
      />
    </div>
  </div>
</template>

<style lang="scss">
.ol-popup-placeholder {
  position: absolute;
  background-color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: var(--r-s);
  border: 1px solid #cccccc;
  bottom: 12px;
  left: -50px;
  min-width: 120px;
  transform: translate(-50%, -10px);

  &::after,
  &::before {
    top: 100%;
    border: solid transparent;
    content: ' ';
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
  }
  &::after {
    border-top-color: white;
    border-width: 10px;
    left: 50%;
    margin-left: -10px;
  }
  &::before {
    border-top-color: #cccccc;
    border-width: 11px;
    left: 50%;
    margin-left: -11px;
  }
}
</style>

<style scoped lang="scss">
.kit-map-wrapper {
  position: relative;
  width: 100%;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-xs);
  overflow: hidden;

  &:fullscreen {
    border-radius: 0;
  }
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(var(--bg-primary-color-rgb), 0.7);
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-weight: 500;
}

.controls-container {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fullscreen-btn {
  padding: 0;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background-color: var(--bg-secondary-color);
  box-shadow: var(--s-m);
}
</style>
