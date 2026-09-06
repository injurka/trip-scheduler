<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import type { EventsKey } from 'ol/events'
import type TileSource from 'ol/source/Tile'
import type { MapLayerOption, MapMarker } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import { unByKey } from 'ol/Observable'
import { fromLonLat, toLonLat } from 'ol/proj'
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { checkMapTilerAvailability, createTileSource, TILE_SOURCES } from '~/shared/lib/map-styles-sources'
import { useKitMap } from '../composables/use-kit-map'
import KitMapControls from './kit-map-controls.vue'
import KitMapSearchControl from './kit-map-search-control.vue'

import 'ol/ol.css'

interface Props {
  center: [number, number]
  zoom?: number
  height?: string
  width?: string
  markers?: MapMarker[]
  autoPan?: boolean
  customLayers?: MapLayerOption[]
  enableSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 12,
  height: '100%',
  width: '100%',
  markers: () => [],
  autoPan: true,
  customLayers: undefined,
  enableSearch: false,
})

const emit = defineEmits<{
  (e: 'mapReady', map: OlMap): void
  (e: 'click', coords: [number, number]): void
}>()

const mapWrapperRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
let clickListenerKey: EventsKey | null = null

const {
  mapInstance,
  isMapReady,
  initMap,
  setTileSource,
  zoomIn,
  zoomOut,
  updateMarkers,
  fitViewToMarkers,
  setSearchResult,
  clearSearchResult,
} = useKitMap()

defineExpose({
  flyTo: (lon: number, lat: number, zoom = 14) => {
    mapInstance.value?.getView().animate({ center: fromLonLat([lon, lat]), zoom, duration: 600 })
  },
  updateSize: () => mapInstance.value?.updateSize(),
})

const isFullscreen = ref(false)

async function toggleFullscreen() {
  if (!mapWrapperRef.value)
    return

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    }
    catch {
      isFullscreen.value = false
    }
  }
  else if (isFullscreen.value) {
    isFullscreen.value = false
  }
  else {
    try {
      if (document.fullscreenEnabled && mapWrapperRef.value.requestFullscreen) {
        await mapWrapperRef.value.requestFullscreen()
      }
      else {
        isFullscreen.value = true
      }
    }
    catch {
      isFullscreen.value = true
    }
  }
  nextTick(() => {
    mapInstance.value?.updateSize()
  })
}

function handleFsChange() {
  isFullscreen.value = document.fullscreenElement === mapWrapperRef.value
  nextTick(() => {
    mapInstance.value?.updateSize()
  })
}

function handleFsKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value && !document.fullscreenElement) {
    isFullscreen.value = false
    nextTick(() => {
      mapInstance.value?.updateSize()
    })
  }
}

const activeLayerId = ref<string>('maptilerOutdoor')
const availableLayers = shallowRef<MapLayerOption[]>([])

watch(
  activeLayerId,
  (newId) => {
    const layer = availableLayers.value.find(l => l.id === newId)
    const source = layer?.source || createTileSource(newId as TileSourceId)

    if (source) {
      setTileSource(source as TileSource)
    }
  },
)

watch(
  () => props.center,
  (newCenter) => {
    mapInstance.value?.getView().animate({ center: fromLonLat(newCenter), duration: 500 })
  },
)

watch(
  () => props.markers,
  (newMarkers) => {
    if (isMapReady.value) {
      updateMarkers(newMarkers)
    }
  },
  { deep: true },
)

onMounted(async () => {
  if (!mapWrapperRef.value || !popupRef.value)
    return

  if (props.customLayers) {
    availableLayers.value = props.customLayers
    activeLayerId.value = props.customLayers[0]?.id || 'osm'
  }
  else {
    const isMapTilerAvailable = await checkMapTilerAvailability()
    const layers: MapLayerOption[] = []

    if (isMapTilerAvailable) {
      layers.push({ id: 'maptilerOutdoor', label: TILE_SOURCES.maptilerOutdoor.label, icon: TILE_SOURCES.maptilerOutdoor.icon, source: createTileSource('maptilerOutdoor') })
      layers.push({ id: 'maptilerStreets', label: TILE_SOURCES.maptilerStreets.label, icon: TILE_SOURCES.maptilerStreets.icon, source: createTileSource('maptilerStreets') })
      layers.push({ id: 'satellite', label: TILE_SOURCES.satellite.label, icon: TILE_SOURCES.satellite.icon, source: createTileSource('satellite') })
    }

    layers.push({ id: 'osm', label: TILE_SOURCES.osm.label, icon: TILE_SOURCES.osm.icon, source: createTileSource('osm') })

    availableLayers.value = layers
    activeLayerId.value = layers[0].id
  }

  const initialSource = availableLayers.value.find(l => l.id === activeLayerId.value)?.source as TileSource

  await initMap(
    mapWrapperRef.value,
    popupRef.value,
    {
      center: props.center,
      zoom: props.zoom,
      autoPan: props.autoPan,
      initialSource,
    },
  )

  if (mapInstance.value) {
    const clickKey = mapInstance.value.on('click', (event) => {
      const lonLat = toLonLat(event.coordinate) as [number, number]
      emit('click', lonLat)
    })
    clickListenerKey = clickKey
    emit('mapReady', mapInstance.value)

    if (props.markers.length > 0) {
      updateMarkers(props.markers)
      fitViewToMarkers()
    }
  }

  document.addEventListener('fullscreenchange', handleFsChange)
  window.addEventListener('keydown', handleFsKeyDown)
})

onUnmounted(() => {
  if (clickListenerKey) {
    unByKey(clickListenerKey)
    clickListenerKey = null
  }
  document.removeEventListener('fullscreenchange', handleFsChange)
  window.removeEventListener('keydown', handleFsKeyDown)
})
</script>

<template>
  <div
    ref="mapWrapperRef"
    class="kit-map-wrapper"
    :class="{ 'is-fullscreen': isFullscreen }"
    :style="isFullscreen ? { height: '100vh', width: '100vw' } : { height, width }"
  >
    <div v-if="!isMapReady" class="loading-overlay">
      <span>Инициализация карты...</span>
    </div>

    <slot />

    <div ref="popupRef" class="ol-popup-placeholder" />

    <KitMapSearchControl
      v-if="enableSearch"
      @found="setSearchResult"
      @clear="clearSearchResult"
    />

    <KitMapControls
      v-model:active-layer-id="activeLayerId"
      :map-instance="mapInstance"
      :layers="availableLayers"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
    />

    <div class="fullscreen-control">
      <KitBtn
        variant="solid"
        color="secondary"
        :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
        size="sm"
        class="fs-btn"
        aria-label="Во весь экран"
        @click="toggleFullscreen"
      />
    </div>
  </div>
</template>

<style lang="scss">
.ol-popup-placeholder {
  position: relative;
  background-color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  padding: 2px;
  border-radius: var(--r-s);
  border: 1px solid #cccccc;
  min-width: 120px;
  pointer-events: none;

  &::after,
  &::before {
    top: 100%;
    left: 50%;
    border: solid transparent;
    content: ' ';
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
    transform: translateX(-50%);
  }

  &::after {
    border-top-color: white;
    border-width: 10px;
    margin-left: 0;
  }

  &::before {
    border-top-color: #cccccc;
    border-width: 11px;
    margin-left: 0;
  }
}
</style>

<style scoped lang="scss">
.kit-map-wrapper {
  position: relative;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  overflow: hidden;

  &:fullscreen,
  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    border-radius: 0;
    width: 100vw !important;
    height: 100vh !important;
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

.fullscreen-control {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

:deep(.fs-btn) {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: var(--s-m);

  &:hover {
    background-color: var(--bg-hover-color);
    transform: none;
  }
}
</style>
