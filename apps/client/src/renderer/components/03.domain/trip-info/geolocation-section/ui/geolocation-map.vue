<script setup lang="ts">
import type { Coordinate, DrawnRoute, MapPoint, MapRoute } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import { onClickOutside } from '@vueuse/core'
import { toLonLat } from 'ol/proj'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
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
  disableContextMenu?: boolean
  withSearchControl?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: true,
  zoom: 14,
  interactiveOnClick: false,
  withPanel: true,
  disableContextMenu: false,
  withSearchControl: false,
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
  searchLocation,
  clearSearchResult,
  ...restMapController
} = useGeolocationMap()

const mapContainerRef = ref<HTMLElement>()

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

const contextMenuRef = ref<HTMLElement | null>(null)
const isContextMenuVisible = ref(false)
const contextMenuPosition = reactive({ top: 0, left: 0, coords: [0, 0] as Coordinate })

function handleSetTileSource(sourceId: TileSourceId) {
  setTileSource(sourceId)
}

function openContextMenu(event: MouseEvent) {
  if (props.disableContextMenu || props.readonly || !mapInstance.value || !isMapActive.value)
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

// Надежные трекеры для отслеживания изменений и удаления старых маркеров/маршрутов
let previousPointIds = new Set<string>()
let previousRouteIds = new Set<string>()
let previousDrawnRouteIds = new Set<string>()

watch(() => props.points, (newPoints) => {
  if (!isMapLoaded.value)
    return

  const newPointIds = new Set(newPoints.map(p => p.id))

  // Удаляем те, которых больше нет
  previousPointIds.forEach((id) => {
    if (!newPointIds.has(id))
      removePoint(id)
  })

  // Добавляем/Обновляем новые
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

watch(() => props.drawnRoutes, (newRoutes) => {
  if (!isMapLoaded.value)
    return

  const newRouteIds = new Set(newRoutes.map(r => r.id))

  previousDrawnRouteIds.forEach((id) => {
    if (!newRouteIds.has(id))
      removeRoute(id)
  })

  newRoutes.forEach((route) => {
    if (route.isVisible)
      addOrUpdateDrawnRoute(route)
    else
      removeRoute(route.id)
  })

  previousDrawnRouteIds = newRouteIds
}, { deep: true })

watch(() => props.readonly, (isReadonly) => {
  if (isMapActive.value)
    modifyInteraction.setActive(!isReadonly)
})

onClickOutside(contextMenuRef, () => {
  isContextMenuVisible.value = false
})

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
    interactive: !props.interactiveOnClick,
  })

  mapInstance.value?.on('click', (event) => {
    if (!isMapActive.value)
      return
    const coords = toLonLat(event.coordinate) as Coordinate
    emit('mapClick', coords)
  })

  emit('mapReady', { mapInstance, isMapLoaded, initMap, addOrUpdatePoint, removePoint, addOrUpdateRoute, addOrUpdateDrawnRoute, removeRoute, modifyInteraction, setTileSource, showCurrentLocation, searchLocation, clearSearchResult, ...restMapController })
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

    props.drawnRoutes.forEach((route) => {
      if (route.isVisible)
        addOrUpdateDrawnRoute(route)
    })
    previousDrawnRouteIds = new Set(props.drawnRoutes.map(r => r.id))
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
  transition: opacity 0.2s ease; /* Добавляем плавное затухание для тултипа */
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
  top: calc(12px + env(safe-area-inset-top));
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
