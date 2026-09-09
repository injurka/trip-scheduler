<script setup lang="ts">
import type { Coordinate, MapPoint, MapRoute } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import { onClickOutside } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { useGeolocationMap } from '../composables/use-geolocation-map'
import GeolocationMapControls from './geolocation-map-controls.vue'

interface Props {
  points: MapPoint[]
  routes: MapRoute[]
  mode: 'pan' | 'add_point' | 'add_route_point' | 'move_point'
  center: Coordinate
  height: string
  isLoading: boolean
  readonly?: boolean
  zoom?: number
  pitch?: number
  bearing?: number
  isFullscreen: boolean
  interactiveOnClick?: boolean
  withPanel?: boolean
  activeItemId?: string | null
  withSearchControl?: boolean
  selectedCoords?: Coordinate | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: true,
  zoom: 14,
  pitch: 0,
  bearing: 0,
  interactiveOnClick: false,
  withPanel: true,
  activeItemId: null,
  withSearchControl: false,
  selectedCoords: null,
})

const emit = defineEmits<{
  (e: 'mapClick', coords: Coordinate): void
  (e: 'mapReady', controller: ReturnType<typeof useGeolocationMap>): void
  (e: 'togglePanel'): void
  (e: 'toggleFullscreen'): void
}>()

const {
  mapInstance,
  isMapLoaded,
  initMap,
  setInteractive,
  addOrUpdatePoint,
  removePoint,
  addOrUpdateRoute,
  removeRoute,
  modifyInteraction,
  setTileSource,
  showCurrentLocation,
  searchLocation,
  clearSearchResult,
  setActivePointId,
  setSelectionMarker,
  ...restMapController
} = useGeolocationMap()

const mapContainerRef = ref<HTMLElement>()
const isMapActive = ref(!props.interactiveOnClick)
const showActivateMessage = ref(false)

function activateMap() {
  if (isMapActive.value || !mapInstance.value)
    return

  isMapActive.value = true
  setInteractive(true)
  modifyInteraction.setActive(!props.readonly)
}

watch(isMapActive, (active) => {
  setInteractive(active)
  if (active) {
    modifyInteraction.setActive(!props.readonly)
  }
  else {
    modifyInteraction.setActive(false)
  }
})

function handleSetTileSource(sourceId: TileSourceId) {
  setTileSource(sourceId)
}

let previousPointIds = new Set<string>()
let previousRouteIds = new Set<string>()

watch(() => props.points, (newPoints) => {
  if (!isMapLoaded.value)
    return

  const newPointIds = new Set(newPoints.map(p => p.id))
  previousPointIds.forEach((id) => {
    if (!newPointIds.has(id))
      removePoint(id)
  })
  newPoints.forEach(addOrUpdatePoint)
  previousPointIds = newPointIds
}, { deep: true })

watch(() => props.routes, (newRoutes) => {
  if (!isMapLoaded.value)
    return

  const newRouteIds = new Set(newRoutes.map(r => r.id))
  previousRouteIds.forEach((id) => {
    if (!newRouteIds.has(id))
      removeRoute(id)
  })

  newRoutes.forEach((route) => {
    if (route.isVisible)
      addOrUpdateRoute(route)
    else
      removeRoute(route.id)
  })
  previousRouteIds = newRouteIds
}, { deep: true })

watch(() => props.readonly, (isReadonly) => {
  if (isMapActive.value)
    modifyInteraction.setActive(!isReadonly)
})

watch(() => props.activeItemId, (newId) => {
  setActivePointId(newId ?? null)
}, { immediate: true })

watch(() => props.selectedCoords, (coords) => {
  setSelectionMarker(coords || null)
}, { immediate: true })

const localSearchQuery = ref('')
const isSearchExpanded = ref(false)
const isSearchingLocal = ref(false)
const inlineSearchRef = ref<HTMLElement | null>(null)

async function handleLocalSearch() {
  if (!localSearchQuery.value.trim())
    return
  isSearchingLocal.value = true
  await searchLocation(localSearchQuery.value)
  isSearchingLocal.value = false
}

function closeLocalSearch() {
  isSearchExpanded.value = false
  localSearchQuery.value = ''
  clearSearchResult()
}

onClickOutside(inlineSearchRef, () => {
  if (isSearchExpanded.value && !localSearchQuery.value.trim()) {
    closeLocalSearch()
  }
})

onMounted(async () => {
  if (!mapContainerRef.value)
    return

  await initMap({
    container: mapContainerRef.value,
    center: props.center,
    zoom: props.zoom,
    pitch: props.pitch,
    bearing: props.bearing,
    interactive: !props.interactiveOnClick,
  })

  mapInstance.value?.on('click', (event) => {
    if (!isMapActive.value)
      return
    const coords: Coordinate = [event.lngLat.lng, event.lngLat.lat]
    emit('mapClick', coords)
  })

  emit('mapReady', {
    mapInstance,
    isMapLoaded,
    initMap,
    setInteractive,
    addOrUpdatePoint,
    removePoint,
    addOrUpdateRoute,
    removeRoute,
    modifyInteraction,
    setTileSource,
    showCurrentLocation,
    searchLocation,
    clearSearchResult,
    setActivePointId,
    setSelectionMarker,
    ...restMapController,
  })
})

watch(isMapLoaded, (isReady) => {
  if (isReady) {
    props.points.forEach(addOrUpdatePoint)
    previousPointIds = new Set(props.points.map(p => p.id))

    props.routes.forEach((route) => {
      if (route.isVisible)
        addOrUpdateRoute(route)
    })
    previousRouteIds = new Set(props.routes.map(r => r.id))
  }
})
</script>

<template>
  <div
    ref="mapContainerRef"
    class="geolocation-map-container"
    :style="{ height: isFullscreen ? '100%' : height }"
    :class="{
      'cursor-crosshair': mode === 'add_point' || mode === 'add_route_point',
      'cursor-grab': mode === 'pan' && isMapActive,
      'cursor-move': mode === 'move_point',
    }"
  >
    <div
      v-if="interactiveOnClick && !isMapActive"
      class="map-activation-overlay"
      @click="activateMap"
      @contextmenu.prevent="activateMap"
      @mouseenter="showActivateMessage = true"
      @mouseleave="showActivateMessage = false"
    >
      <Transition name="fade">
        <div v-if="showActivateMessage" class="overlay-message">
          Нажмите, чтобы активировать карту
        </div>
      </Transition>
    </div>

    <div v-if="!isMapLoaded || isLoading" class="loading-overlay">
      <span>{{ isLoading ? 'Загрузка...' : 'Инициализация карты...' }}</span>
    </div>

    <div v-if="withSearchControl" ref="inlineSearchRef" class="map-inline-search" :class="{ expanded: isSearchExpanded }">
      <KitBtn
        v-if="!isSearchExpanded"
        variant="outlined"
        color="secondary"
        icon="mdi:magnify"
        aria-label="Поиск по карте"
        class="search-trigger-btn"
        @click="isSearchExpanded = true"
      />
      <div v-else class="search-expanded-wrapper">
        <KitInput
          v-model="localSearchQuery"
          placeholder="Найти место на карте..."
          size="sm"
          @keydown.enter="handleLocalSearch"
        />
        <KitBtn
          icon="mdi:magnify"
          size="sm"
          variant="solid"
          :loading="isSearchingLocal"
          @click="handleLocalSearch"
        />
        <KitBtn
          icon="mdi:close"
          size="sm"
          variant="subtle"
          @click="closeLocalSearch"
        />
      </div>
    </div>

    <slot name="controls" :map-instance="mapInstance">
      <GeolocationMapControls
        :map-instance="mapInstance"
        :is-fullscreen="isFullscreen"
        :portal-target="mapContainerRef"
        :with-panel="withPanel"
        @toggle-panel="$emit('togglePanel')"
        @toggle-fullscreen="$emit('toggleFullscreen')"
        @set-tile-source="handleSetTileSource"
        @center-on-my-location="showCurrentLocation"
      />
    </slot>

    <slot name="fullscreen-panel" />
  </div>
</template>

<style>
.cursor-move {
  cursor: move;
}

.ol-attribution {
  bottom: 6px !important;
  right: 6px !important;
  background: rgba(var(--bg-secondary-color-rgb), 0.85) !important;
  backdrop-filter: blur(6px) !important;
  border-radius: var(--r-xs) !important;
  border: 1px solid var(--border-secondary-color) !important;
  font-size: 0.65rem !important;
  line-height: 1.2 !important;
  padding: 2px !important;
  max-width: calc(100% - 100px);

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    color: var(--fg-secondary-color);
  }

  a {
    color: var(--fg-primary-color) !important;
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }

  button {
    background-color: transparent !important;
    color: var(--fg-secondary-color) !important;
    font-size: 0.75rem !important;
    border: none !important;
    cursor: pointer;
  }
}
</style>

<style scoped lang="scss">
.geolocation-map-container {
  position: relative;
  width: 100%;
  border-radius: var(--r-xs);
  overflow: hidden;
  user-select: none;

  &.cursor-crosshair {
    cursor: crosshair;
  }
  &.cursor-grab {
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
  }
}

.map-activation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  .overlay-message {
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    border-radius: var(--r-s);
    font-size: 0.9rem;
    font-weight: 500;
    pointer-events: none;
    box-shadow: var(--s-m);
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--bg-primary-color-rgb), 0.7);
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-weight: 500;
}

.map-inline-search {
  position: absolute;
  top: calc(12px + var(--safe-area-inset-top));
  left: 12px;
  z-index: 8;

  .search-trigger-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    background-color: var(--bg-secondary-color);

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }

  .search-expanded-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary-color);
    padding: 4px;
    border-radius: var(--r-m);
    box-shadow: var(--s-m);
    border: 1px solid var(--border-secondary-color);

    .kit-btn,
    :deep(.kit-btn) {
      width: 30px;
      height: 30px;
      padding: 0;
    }

    :deep(.kit-input-wrapper) {
      width: 220px;

      input {
        background-color: transparent;
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
