<script setup lang="ts">
import type { TileSourceId } from '../constant/map-styles'
import type { Coordinate, DrawnRoute, MapPoint, MapRoute } from '../models/types'
import { onClickOutside } from '@vueuse/core'
import { toLonLat } from 'ol/proj'
import { useGeolocationMap } from '../composables/use-geolocation-map'
import GeolocationContextMenu from './geolocation-context-menu.vue'
import GeolocationMapControls from './geolocation-map-controls.vue'

import 'ol/ol.css'

interface Props {
  points: MapPoint[]
  routes: MapRoute[]
  drawnRoutes: DrawnRoute[]
  mode: 'pan' | 'add_point' | 'add_route_point' | 'draw_route' | 'move_point'
  center: Coordinate
  height: string
  isLoading: boolean
  readonly?: boolean
  zoom?: number
  isFullscreen: boolean
  interactiveOnClick?: boolean
  withPanel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: true,
  zoom: 14,
  interactiveOnClick: false,
  withPanel: true,
})

const emit = defineEmits<{
  (e: 'mapClick', coords: Coordinate): void
  (e: 'contextMenuAction', actionId: string, coords: Coordinate): void
  (e: 'mapReady', controller: ReturnType<typeof useGeolocationMap>): void
  (e: 'togglePanel'): void
  (e: 'toggleFullscreen'): void
}>()

const {
  mapInstance,
  isMapLoaded,
  initMap,
  addOrUpdatePoint,
  removePoint,
  addOrUpdateRoute,
  addOrUpdateDrawnRoute,
  removeRoute,
  modifyInteraction,
  setTileSource,
  showCurrentLocation,
  ...restMapController
} = useGeolocationMap()

const mapContainerRef = ref<HTMLElement>()

// --- Логика активации карты по клику ---
const isMapActive = ref(!props.interactiveOnClick)
const showActivateMessage = ref(false)

function activateMap() {
  if (isMapActive.value || !mapInstance.value)
    return

  isMapActive.value = true
  mapInstance.value.getInteractions().forEach((interaction) => {
    interaction.setActive(true)
  })
  modifyInteraction.setActive(!props.readonly)
}

// --- Контекстное меню ---
const contextMenuRef = ref<HTMLElement | null>(null)
const isContextMenuVisible = ref(false)
const contextMenuPosition = reactive({ top: 0, left: 0, coords: [0, 0] as Coordinate })

function handleSetTileSource(sourceId: TileSourceId) {
  setTileSource(sourceId)
}

function openContextMenu(event: MouseEvent) {
  if (props.readonly || !mapInstance.value || !isMapActive.value)
    return
  const mapContainer = mapInstance.value.getTargetElement() as HTMLElement
  const mapRect = mapContainer.getBoundingClientRect()
  contextMenuPosition.top = event.clientY - mapRect.top
  contextMenuPosition.left = event.clientX - mapRect.left
  const pixel = [event.clientX - mapRect.left, event.clientY - mapRect.top]
  contextMenuPosition.coords = toLonLat(mapInstance.value.getCoordinateFromPixel(pixel)) as Coordinate
  isContextMenuVisible.value = true
}

function handleContextMenuAction(actionId: string) {
  isContextMenuVisible.value = false
  emit('contextMenuAction', actionId, contextMenuPosition.coords)
}

// --- Синхронизация с состоянием ---
watch(() => props.points, (newPoints, oldPoints = []) => {
  if (!isMapLoaded.value)
    return

  const newPointIds = new Set(newPoints.map(p => p.id))
  oldPoints.forEach((point) => {
    if (!newPointIds.has(point.id))
      removePoint(point.id)
  })
  newPoints.forEach(addOrUpdatePoint)
}, { deep: true })

watch(() => props.routes, (newRoutes, oldRoutes = []) => {
  if (!isMapLoaded.value)
    return
  const newRouteIds = new Set(newRoutes.map(r => r.id))
  oldRoutes.forEach((route) => {
    if (!newRouteIds.has(route.id))
      removeRoute(route.id)
  })
  newRoutes.forEach((route) => {
    if (route.isVisible)
      addOrUpdateRoute(route)
    else
      removeRoute(route.id)
  })
}, { deep: true })

watch(() => props.drawnRoutes, (newRoutes, oldRoutes = []) => {
  if (!isMapLoaded.value)
    return
  const newRouteIds = new Set(newRoutes.map(r => r.id))
  oldRoutes.forEach((route) => {
    if (!newRouteIds.has(route.id))
      removeRoute(route.id)
  })
  newRoutes.forEach((route) => {
    if (route.isVisible)
      addOrUpdateDrawnRoute(route)
    else
      removeRoute(route.id)
  })
}, { deep: true })

watch(() => props.readonly, (isReadonly) => {
  if (isMapActive.value)
    modifyInteraction.setActive(!isReadonly)
})

onClickOutside(contextMenuRef, () => {
  isContextMenuVisible.value = false
})

onMounted(async () => {
  if (!mapContainerRef.value)
    return
  await initMap({
    container: mapContainerRef.value,
    center: props.center,
    zoom: props.zoom,
    interactive: !props.interactiveOnClick,
  })

  mapInstance.value?.on('click', (event) => {
    if (!isMapActive.value)
      return
    const coords = toLonLat(event.coordinate) as Coordinate
    emit('mapClick', coords)
  })

  emit('mapReady', { mapInstance, isMapLoaded, initMap, addOrUpdatePoint, removePoint, addOrUpdateRoute, addOrUpdateDrawnRoute, removeRoute, modifyInteraction, setTileSource, showCurrentLocation, ...restMapController })
})

watch(isMapLoaded, (isReady) => {
  if (isReady) {
    props.points.forEach(addOrUpdatePoint)
    props.routes.forEach((route) => {
      if (route.isVisible)
        addOrUpdateRoute(route)
    })
    props.drawnRoutes.forEach((route) => {
      if (route.isVisible)
        addOrUpdateDrawnRoute(route)
    })
  }
})
</script>

<template>
  <div
    ref="mapContainerRef"
    class="geolocation-map-container"
    :style="{ height }"
    :class="{ 'cursor-crosshair': mode === 'add_point' || mode === 'add_route_point' || mode === 'draw_route', 'cursor-grab': mode === 'pan' && isMapActive, 'cursor-move': mode === 'move_point' }"
    @contextmenu.prevent="openContextMenu"
  >
    <div
      v-if="interactiveOnClick && !isMapActive"
      class="map-activation-overlay"
      @click="activateMap"
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
    <div ref="contextMenuRef">
      <GeolocationContextMenu
        :visible="isContextMenuVisible"
        :top="contextMenuPosition.top"
        :left="contextMenuPosition.left"
        @action="handleContextMenuAction"
      />
    </div>
    <slot name="fullscreen-panel" />
  </div>
</template>

<style>
.ol-popup-comment {
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  padding: 6px 10px;
  border-radius: var(--r-xs);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
}
.cursor-move {
  cursor: move;
}
</style>

<style scoped lang="scss">
.geolocation-map-container {
  position: relative;
  width: 100%;
  border-radius: var(--r-xs);
  overflow: hidden;
  &.cursor-crosshair {
    cursor: crosshair;
  }
  &.cursor-grab {
    cursor: grab;
  }
}

.map-activation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9; /* Below controls (z-index: 10) */
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
