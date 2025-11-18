<script setup lang="ts">
import type { useGeolocationMap } from '../composables/use-geolocation-map'
import type { ActivitySectionGeolocation, Coordinate, DrawnRoute, MapPoint, MapRoute } from '../models/types'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { useDebounceFn } from '@vueuse/core'
import { toLonLat } from 'ol/proj'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useGeolocationDrawing } from '../composables/use-geolocation-drawing'
import { useGeolocationPoints } from '../composables/use-geolocation-points'
import { useGeolocationRoutes } from '../composables/use-geolocation-routes'
import { POI_COLORS } from '../constant'
import GeolocationMap from './geolocation-map.vue'
import GeolocationPoiList from './geolocation-poi-list.vue'
import GeolocationRouteList from './geolocation-route-list.vue'

interface Props {
  section: ActivitySectionGeolocation
  readonly?: boolean
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  height: '450px',
})

const emit = defineEmits<{
  (e: 'updateSection', value: ActivitySectionGeolocation): void
}>()

// --- Состояние компонента ---
const isInitialized = ref(false)

const sectionContainerRef = ref<HTMLElement | null>(null)
const mapController = ref<ReturnType<typeof useGeolocationMap>>()
const activeView = ref<'points' | 'routes'>('points')
const activeRouteId = ref<string | null>(null)
const isMapFullscreen = ref(false)
const isPanelVisible = ref(false)
const routeIdForNewSegment = ref<string | null>(null)
const searchQuery = ref('')

// --- Композиции ---
const {
  points,
  isLoading: isPointsLoading,
  mode,
  pointToMoveId,
  addPoiPoint,
  deletePoiPoint,
  startMovePoint,
  movePoint: movePoiPoint,
  updatePointCoords,
  handlePointUpdate,
  refreshPointAddress,
  setInitialPoints,
} = useGeolocationPoints(mapController)

const {
  routes,
  drawnRoutes,
  isLoading: isRoutesLoading,
  createNewRoute,
  addPointToRoute,
  deleteRoute,
  deletePointFromRoute,
  updatePointInRoute,
  handlePointDataUpdate: handleRoutePointUpdate,
  refreshRoutePointAddress,
  setInitialRoutes,
  addDrawnRoute,
  addSegmentToDrawnRoute,
  deleteSegmentFromDrawnRoute,
} = useGeolocationRoutes(mapController)

const { startDrawing, stopDrawing } = useGeolocationDrawing(mapController)

const debouncedUpdate = useDebounceFn(() => {
  if (!isInitialized.value)
    return

  const currentCenter = mapController.value?.mapInstance.value?.getView().getCenter()
  const currentZoom = mapController.value?.mapInstance.value?.getView().getZoom()

  emit('updateSection', {
    ...props.section,
    points: toRaw(points.value),
    routes: toRaw(routes.value),
    drawnRoutes: toRaw(drawnRoutes.value),
    center: currentCenter ? (toLonLat(currentCenter) as Coordinate) : props.section.center,
    zoom: currentZoom ?? props.section.zoom,
  })
}, 1000)

const isLoading = computed(() => isPointsLoading.value || isRoutesLoading.value)
const poiPointsWithStyle = computed(() => points.value.map((point, index) => ({
  ...point,
  style: {
    ...point.style,
    color: POI_COLORS[index % POI_COLORS.length],
  },
})))
const allMapPoints = computed(() => {
  const routePoints = routes.value.flatMap(r => r.points.map((p, index) => {
    let type: MapPoint['type'] = 'via'

    if (index === 0)
      type = 'start'
    if (index === r.points.length - 1 && r.points.length > 1)
      type = 'end'

    return {
      ...p,
      type,
      style: {
        ...p.style,
        color: r.color,
      },
    }
  }))

  return [...poiPointsWithStyle.value, ...routePoints]
})

// --- Вычисляемые свойства ---
const areItemsEmpty = computed(() => {
  return points.value.length === 0 && routes.value.length === 0 && drawnRoutes.value.length === 0
})

const mapCenter = computed<Coordinate>(() => {
  if (props.section?.center)
    return props.section.center

  if (props.section?.points?.length > 0)
    return props.section.points[0].coordinates

  if (props.section?.routes?.length > 0 && props.section.routes[0].points.length > 0)
    return props.section.routes[0].points[0].coordinates

  return [37.6176, 55.7558] // Москва
})

const viewItems: ViewSwitcherItem[] = [
  { id: 'points', icon: 'mdi:map-marker-multiple', label: 'Точки' },
  { id: 'routes', icon: 'mdi:directions', label: 'Маршруты' },
]
const modeItems = computed((): ViewSwitcherItem[] => {
  if (activeView.value === 'points') {
    return [
      { id: 'pan', icon: 'mdi:cursor-move', label: 'Панорама' },
      { id: 'add_point', icon: 'mdi:map-marker-plus', label: 'Точка' },
    ]
  }
  return [
    { id: 'pan', icon: 'mdi:cursor-move', label: 'Панорама' },
    { id: 'add_route_point', icon: 'mdi:source-commit-start-next-local', label: 'Добавить в маршрут' },
    // { id: 'draw_route', icon: 'mdi:draw', label: 'Нарисовать' },
  ]
})

// --- Обработчики ---
async function handleMapClick(coords: Coordinate) {
  if (props.readonly)
    return

  if (mode.value === 'add_point') {
    await addPoiPoint(coords)
    mode.value = 'pan'
  }
  else if (mode.value === 'add_route_point') {
    if (!activeRouteId.value) {
      useToast().info('Сначала выберите или создайте маршрут для добавления точки.')
      return
    }
    await addPointToRoute(activeRouteId.value, coords)
  }
  else if (mode.value === 'move_point' && pointToMoveId.value) {
    if (points.value.some(p => p.id === pointToMoveId.value))
      await movePoiPoint(pointToMoveId.value, coords)
    else
      await updatePointInRoute(pointToMoveId.value, coords)

    pointToMoveId.value = null
    mode.value = 'pan'
  }
}

async function handleContextMenuAction(actionId: string, coords: Coordinate) {
  if (actionId === 'route-from') {
    const newRoute = await createNewRoute(coords)
    if (newRoute) {
      activeRouteId.value = newRoute.id
      activeView.value = 'routes'
      mode.value = 'add_route_point'
    }
  }
  else if (actionId === 'draw-new-route') {
    activeView.value = 'routes'
    mode.value = 'draw_route'
  }
  else if (actionId === 'show-current-location') {
    mapController.value?.showCurrentLocation()
  }
  else if (actionId === 'center-map') {
    mapController.value?.flyToLocation(coords[0], coords[1])
  }
  else if (actionId === 'show-address') {
    const addressInfo = await mapController.value?.fetchAddress(coords)
    if (addressInfo?.address)
      mapController.value?.showPopup(coords, addressInfo.address)
    else
      mapController.value?.showPopup(coords, 'Адрес не найден')
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim() || !mapController.value)
    return
  const found = await mapController.value.searchLocation(searchQuery.value)
  if (!found)
    useToast().error('Местоположение не найдено.')
}

function clearSearch() {
  searchQuery.value = ''
}

watch(searchQuery, (newQuery) => {
  if (newQuery.trim() === '')
    mapController.value?.clearSearchResult()
})

function handleFocusOnPoint(point: MapPoint) {
  mapController.value?.flyToLocation(point.coordinates[0], point.coordinates[1], 17)
}

function handleStartMovePoint(pointId: string) {
  startMovePoint(pointId)
  mode.value = 'move_point'
}

function handleRouteUpdate(route: MapRoute | DrawnRoute) {
  const pointRouteIndex = routes.value.findIndex(r => r.id === route.id)
  if (pointRouteIndex !== -1) {
    routes.value[pointRouteIndex] = { ...routes.value[pointRouteIndex], ...route }
    return
  }
  const drawnRouteIndex = drawnRoutes.value.findIndex(r => r.id === route.id)
  if (drawnRouteIndex !== -1)
    drawnRoutes.value[drawnRouteIndex] = { ...drawnRoutes.value[drawnRouteIndex], ...route }
}

function handleAddSegment(routeId: string) {
  routeIdForNewSegment.value = routeId
  mode.value = 'draw_route'
}

function setActiveRoute(routeId: string | null) {
  activeRouteId.value = routeId
  if (routeId)
    mode.value = 'add_route_point'
  else
    mode.value = 'pan'
}

// --- Полноэкранный режим ---
function handleToggleFullscreen() {
  if (!sectionContainerRef.value)
    return

  if (!document.fullscreenElement) {
    sectionContainerRef.value.requestFullscreen().catch((err) => {
      console.error(`Ошибка при попытке включить полноэкранный режим: ${err.message} (${err.name})`)
    })
  }
  else {
    document.exitFullscreen()
  }
}

function handleFullscreenChange() {
  isMapFullscreen.value = document.fullscreenElement === sectionContainerRef.value
}

// --- Инициализация и синхронизация ---
async function onMapReady(controller: ReturnType<typeof useGeolocationMap>) {
  mapController.value = controller
  setInitialPoints(props.section.points)
  await setInitialRoutes({ routes: props.section.routes, drawnRoutes: props.section.drawnRoutes })

  controller.modifyInteraction.on('modifyend', (event) => {
    const feature = event.features.getArray()[0]
    if (!feature)
      return
    const pointId = feature.getId() as string
    const newCoords = toLonLat((feature.getGeometry() as any).getCoordinates()) as Coordinate
    if (points.value.some(p => p.id === pointId))
      movePoiPoint(pointId, newCoords)
    else
      updatePointInRoute(pointId, newCoords, false)
  })

  isInitialized.value = true
  watch(
    [points, routes, drawnRoutes],
    debouncedUpdate,
    { deep: true },
  )
}

watch(
  activeView,
  () => {
    mode.value = 'pan'
    activeRouteId.value = null
  },
)

watchEffect(() => {
  if (!mapController.value)
    return

  if (mode.value === 'draw_route') {
    startDrawing((coords) => {
      if (routeIdForNewSegment.value) {
        addSegmentToDrawnRoute(routeIdForNewSegment.value, coords)
        routeIdForNewSegment.value = null
      }
      else {
        addDrawnRoute(coords)
      }
      mode.value = 'pan'
    })
  }
  else {
    stopDrawing()
  }
})

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  stopDrawing()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <div ref="sectionContainerRef" class="geolocation-section" :class="{ 'is-fullscreen': isMapFullscreen }">
    <div
      v-show="!isMapFullscreen || isPanelVisible"
      class="main-panel"
      :class="{ 'fullscreen-panel': isMapFullscreen }"
    >
      <!-- ПАНЕЛЬ УПРАВЛЕНИЯ -->
      <div v-if="!readonly">
        <div class="geolocation-controls-panel">
          <div class="search-control">
            <KitInput v-model="searchQuery" size="sm" placeholder="Найти место на карте..." @keydown.enter="handleSearch" />
            <KitBtn icon="mdi:magnify" size="sm" @click="handleSearch" />
            <KitBtn v-if="searchQuery" icon="mdi:close" size="sm" variant="subtle" @click="clearSearch" />
          </div>
          <KitViewSwitcher v-model="activeView" :items="viewItems" />
          <KitViewSwitcher v-model="mode" :items="modeItems" />
        </div>
      </div>

      <!-- СПИСКИ -->
      <div class="lists-container">
        <p v-if="areItemsEmpty" class="no-items-message">
          Маршруты или маркеры не созданы.
        </p>
        <template v-else>
          <template v-if="!readonly">
            <GeolocationPoiList
              v-if="activeView === 'points'"
              :points="poiPointsWithStyle"
              :readonly="readonly"
              @focus-on-point="handleFocusOnPoint"
              @update-point="handlePointUpdate"
              @update-point-coords="updatePointCoords"
              @start-move-point="handleStartMovePoint"
              @delete-point="deletePoiPoint"
              @refresh-address="refreshPointAddress"
            />
            <GeolocationRouteList
              v-if="activeView === 'routes'"
              :routes="routes"
              :drawn-routes="drawnRoutes"
              :readonly="readonly"
              :active-route-id="activeRouteId"
              @focus-on-point="handleFocusOnPoint"
              @update-point="handleRoutePointUpdate"
              @update-route="handleRouteUpdate"
              @update-point-coords="updatePointCoords"
              @start-move-point="handleStartMovePoint"
              @delete-point="deletePointFromRoute"
              @delete-route="deleteRoute"
              @set-active-route="setActiveRoute"
              @add-segment="handleAddSegment"
              @delete-segment="deleteSegmentFromDrawnRoute"
              @refresh-address="refreshRoutePointAddress"
            />
          </template>
          <template v-else>
            <GeolocationPoiList
              :points="poiPointsWithStyle"
              :readonly="readonly"
              @focus-on-point="handleFocusOnPoint"
            />
            <GeolocationRouteList
              :routes="routes"
              :drawn-routes="drawnRoutes"
              :readonly="readonly"
              :active-route-id="activeRouteId"
              @focus-on-point="handleFocusOnPoint"
            />
          </template>
        </template>
      </div>
    </div>

    <!-- КАРТА -->
    <GeolocationMap
      class="map-wrapper"
      :points="allMapPoints"
      :routes="routes"
      :drawn-routes="drawnRoutes"
      :mode="mode"
      :center="mapCenter"
      :height="height"
      :is-loading="isLoading"
      :zoom="section.zoom"
      :readonly="readonly"
      :is-fullscreen="isMapFullscreen"
      :interactive-on-click="true"
      @map-ready="onMapReady"
      @map-click="handleMapClick"
      @context-menu-action="handleContextMenuAction"
      @toggle-panel="isPanelVisible = !isPanelVisible"
      @toggle-fullscreen="handleToggleFullscreen"
    />
  </div>
</template>

<style scoped lang="scss">
.geolocation-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2000;
    background-color: var(--bg-primary-color);
    padding: 0;
    border-radius: 0;
    border: none;
  }
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  background-color: var(--bg-primary-color);
  border-radius: var(--r-xs);
  padding: 4px;

  &.fullscreen-panel {
    position: absolute;
    left: 12px;
    top: calc(12px + env(safe-area-inset-top));
    bottom: 12px;
    z-index: 1001;
    width: 380px;
    max-width: calc(100% - 80px);
    box-shadow: var(--s-l);
    border: 1px solid var(--border-primary-color);
  }
}

.geolocation-controls-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: var(--bg-secondary-color);
  padding: 6px;
  border-radius: var(--r-xs);

  .kit-view-switcher {
    display: flex;
    :deep(> *) {
      flex: 1 1 0;
    }
  }
}

.search-control {
  display: flex;
  gap: 4px;
}

.lists-container {
  overflow-y: auto;
  flex-grow: 1;
}

.map-wrapper {
  min-width: 0;
  flex-grow: 1;
}

.no-items-message {
  text-align: center;
  padding: 16px 8px;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
}
</style>
