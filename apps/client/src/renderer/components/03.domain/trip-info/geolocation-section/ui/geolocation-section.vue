<script setup lang="ts">
import type { useGeolocationMap } from '../composables/use-geolocation-map'
import type { ActivitySectionGeolocation, Coordinate, DrawnRoute, MapPoint, MapRoute } from '../models/types'
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { toLonLat } from 'ol/proj'
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

const isInitialized = ref(false)

const sectionContainerRef = ref<HTMLElement | null>(null)
const mapController = ref<ReturnType<typeof useGeolocationMap>>()
const activeView = ref<'points' | 'routes'>('points')
const activeRouteId = ref<string | null>(null)
const isMapFullscreen = ref(false)
const isPanelVisible = ref(false)
const routeIdForNewSegment = ref<string | null>(null)
const searchQuery = ref('')
const routePointType = ref<'via' | 'connect'>('via')

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
  setRouteTransportMode,
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
    let type: MapPoint['type'] = p.type

    if (index === 0)
      type = 'start'

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

const mapCenter = computed<Coordinate>(() => {
  if (props.section?.center)
    return props.section.center

  if (props.section?.points?.length > 0)
    return props.section.points[0].coordinates

  if (props.section?.routes?.length > 0 && props.section.routes[0].points.length > 0)
    return props.section.routes[0].points[0].coordinates

  return [37.6176, 55.7558] // Москва
})

function toggleMode(targetMode: typeof mode.value) {
  if (mode.value === targetMode)
    mode.value = 'pan'
  else
    mode.value = targetMode
}

function startNewRouteMode() {
  activeView.value = 'routes'
  activeRouteId.value = null
  mode.value = 'add_route_point'
}

async function handleMapClick(coords: Coordinate) {
  if (props.readonly)
    return

  if (mode.value === 'add_point') {
    await addPoiPoint(coords)
    mode.value = 'pan'
  }
  else if (mode.value === 'add_route_point') {
    if (!activeRouteId.value) {
      const newRoute = await createNewRoute(coords)
      if (newRoute) {
        activeRouteId.value = newRoute.id
      }
      return
    }
    await addPointToRoute(activeRouteId.value, coords, routePointType.value)
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
    const prevMode = routes.value[pointRouteIndex].transportMode
    routes.value[pointRouteIndex] = { ...routes.value[pointRouteIndex], ...route }
    if ('transportMode' in route && route.transportMode !== prevMode) {
      setRouteTransportMode(route.id, route.transportMode || 'foot')
    }
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
      <!-- Верхний тулбар: Поиск и сегментные табы -->
      <div v-if="!readonly" class="geo-top-toolbar">
        <div class="search-input-wrapper">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск места на карте..."
            class="search-input"
            @keydown.enter="handleSearch"
          >
          <button v-if="searchQuery" type="button" class="clear-search-btn" @click="clearSearch">
            <Icon icon="mdi:close-circle" />
          </button>
          <button type="button" class="search-submit-btn" @click="handleSearch">
            Найти
          </button>
        </div>

        <div class="geo-tabs">
          <button
            type="button"
            class="geo-tab-btn"
            :class="{ 'is-active': activeView === 'points' }"
            @click="activeView = 'points'"
          >
            <Icon icon="mdi:map-marker-multiple" />
            <span>Точки</span>
            <span class="tab-count">{{ points.length }}</span>
          </button>

          <button
            type="button"
            class="geo-tab-btn"
            :class="{ 'is-active': activeView === 'routes' }"
            @click="activeView = 'routes'"
          >
            <Icon icon="mdi:directions" />
            <span>Маршруты</span>
            <span class="tab-count">{{ routes.length + drawnRoutes.length }}</span>
          </button>
        </div>
      </div>

      <!-- Панель быстрых действий и активных режимов -->
      <div v-if="!readonly" class="geo-actions-toolbar">
        <!-- Режим: ТОЧКИ -->
        <template v-if="activeView === 'points'">
          <div v-if="mode === 'add_point'" class="active-banner">
            <span class="banner-text">
              <span class="pulse-dot" />
              Кликните на карту, чтобы поставить метку
            </span>
            <button type="button" class="banner-cancel-btn" @click="mode = 'pan'">
              Отмена
            </button>
          </div>

          <div v-else-if="mode === 'move_point'" class="active-banner move-banner">
            <span class="banner-text">
              <Icon icon="mdi:cursor-move" />
              Кликните на карте новое место для точки
            </span>
            <button type="button" class="banner-cancel-btn" @click="mode = 'pan'; pointToMoveId = null">
              Отмена
            </button>
          </div>

          <div v-else class="quick-actions-row">
            <button
              type="button"
              class="primary-action-pill"
              @click="toggleMode('add_point')"
            >
              <Icon icon="mdi:map-marker-plus" />
              <span>Добавить точку на карту</span>
            </button>
          </div>
        </template>

        <!-- Режим: МАРШРУТЫ -->
        <template v-if="activeView === 'routes'">
          <!-- Если активен режим редактирования маршрута -->
          <div v-if="activeRouteId" class="active-banner route-edit-banner">
            <div class="banner-left">
              <span class="pulse-dot" />
              <span class="banner-text">Добавление точек в маршрут</span>
              <div class="point-type-pills">
                <button
                  type="button"
                  class="type-pill"
                  :class="{ 'is-active': routePointType === 'via' }"
                  @click="routePointType = 'via'"
                >
                  Метка
                </button>
                <button
                  type="button"
                  class="type-pill"
                  :class="{ 'is-active': routePointType === 'connect' }"
                  @click="routePointType = 'connect'"
                >
                  Точка
                </button>
              </div>
            </div>
            <button type="button" class="banner-done-btn" @click="setActiveRoute(null)">
              ✓ Готово
            </button>
          </div>

          <!-- Если активен режим рисования -->
          <div v-else-if="mode === 'draw_route'" class="active-banner draw-banner">
            <span class="banner-text">
              <Icon icon="mdi:draw" />
              Зажмите и ведите по карте для рисования линии
            </span>
            <button type="button" class="banner-cancel-btn" @click="mode = 'pan'">
              Завершить
            </button>
          </div>

          <!-- Обычный режим маршрутов -->
          <div v-else class="quick-actions-row">
            <button
              type="button"
              class="primary-action-pill"
              @click="startNewRouteMode"
            >
              <Icon icon="mdi:plus" />
              <span>Новый маршрут</span>
            </button>

            <button
              type="button"
              class="secondary-action-pill"
              @click="toggleMode('draw_route')"
            >
              <Icon icon="mdi:draw" />
              <span>Нарисовать</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Список точек / маршрутов -->
      <div class="lists-container">
        <!-- Вкладка ТОЧКИ -->
        <template v-if="activeView === 'points'">
          <div v-if="points.length === 0" class="empty-state-card">
            <div class="empty-icon-wrap">
              <Icon icon="mdi:map-marker-outline" />
            </div>
            <div class="empty-title">
              Нет добавленных точек
            </div>
            <div class="empty-subtitle">
              Поставьте метку кликом на карту или найдите адрес через поиск выше
            </div>
            <button
              v-if="!readonly"
              type="button"
              class="empty-action-btn"
              @click="toggleMode('add_point')"
            >
              <Icon icon="mdi:plus" />
              <span>Поставить точку на карте</span>
            </button>
          </div>

          <GeolocationPoiList
            v-else
            :points="poiPointsWithStyle"
            :readonly="readonly"
            @focus-on-point="handleFocusOnPoint"
            @update-point="handlePointUpdate"
            @update-point-coords="updatePointCoords"
            @start-move-point="handleStartMovePoint"
            @delete-point="deletePoiPoint"
            @refresh-address="refreshPointAddress"
          />
        </template>

        <!-- Вкладка МАРШРУТЫ -->
        <template v-if="activeView === 'routes'">
          <div v-if="routes.length === 0 && drawnRoutes.length === 0" class="empty-state-card">
            <div class="empty-icon-wrap">
              <Icon icon="mdi:routes" />
            </div>
            <div class="empty-title">
              Маршруты не созданы
            </div>
            <div class="empty-subtitle">
              Стройте пешеходные, велосипедные или автомобильные маршруты между точками
            </div>
            <div v-if="!readonly" class="empty-actions-row">
              <button
                type="button"
                class="empty-action-btn"
                @click="startNewRouteMode"
              >
                <Icon icon="mdi:plus" />
                <span>Создать маршрут</span>
              </button>
              <button
                type="button"
                class="empty-action-btn secondary"
                @click="toggleMode('draw_route')"
              >
                <Icon icon="mdi:draw" />
                <span>Нарисовать от руки</span>
              </button>
            </div>
          </div>

          <GeolocationRouteList
            v-else
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
            @set-transport-mode="setRouteTransportMode"
          />
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
  gap: 8px;
  padding: 6px;
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
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px;

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
    backdrop-filter: blur(12px);
    background-color: rgba(var(--bg-primary-color-rgb), 0.95);
  }
}

.geo-top-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 2px 4px 2px 10px;
  transition: all 0.2s ease;

  &:focus-within {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }

  .search-icon {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    margin-right: 6px;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--fg-primary-color);
    font-size: 0.85rem;
    outline: none;

    &::placeholder {
      color: var(--fg-tertiary-color);
    }
  }

  .clear-search-btn {
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px;
    font-size: 0.95rem;

    &:hover {
      color: var(--fg-primary-color);
    }
  }

  .search-submit-btn {
    padding: 4px 10px;
    border-radius: var(--r-xs);
    border: 1px solid var(--border-secondary-color);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
      border-color: var(--border-primary-color);
    }
  }
}

.geo-tabs {
  display: flex;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 3px;
  gap: 4px;
}

.geo-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  .iconify {
    font-size: 1rem;
  }

  .tab-count {
    font-size: 0.72rem;
    padding: 1px 6px;
    border-radius: var(--r-full);
    background-color: rgba(var(--fg-secondary-color-rgb), 0.15);
    color: var(--fg-secondary-color);
  }

  &:hover {
    color: var(--fg-primary-color);
  }

  &.is-active {
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: var(--s-xs);

    .tab-count {
      background-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
    }
  }
}

.geo-actions-toolbar {
  display: flex;
  flex-direction: column;
}

.quick-actions-row {
  display: flex;
  gap: 6px;
}

.primary-action-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  .iconify {
    font-size: 1rem;
    color: var(--fg-accent-color);
  }

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }
}

.secondary-action-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.active-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--r-s);
  background-color: rgba(var(--fg-accent-color-rgb), 0.1);
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.3);
  font-size: 0.82rem;
  color: var(--fg-primary-color);

  .banner-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .banner-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .banner-cancel-btn {
    border: none;
    background: transparent;
    color: var(--fg-secondary-color);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;

    &:hover {
      color: var(--fg-error-color);
    }
  }

  .banner-done-btn {
    padding: 4px 10px;
    border-radius: var(--r-xs);
    border: none;
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      opacity: 0.9;
    }
  }
}

.point-type-pills {
  display: flex;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  padding: 1px;
}

.type-pill {
  padding: 2px 8px;
  font-size: 0.72rem;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  border-radius: var(--r-2xs);
  cursor: pointer;

  &.is-active {
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
  }
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--fg-accent-color);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }
  100% {
    transform: scale(0.9);
    opacity: 1;
  }
}

.lists-container {
  overflow-y: auto;
  max-height: 280px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: var(--r-full);
  }
}

.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  background-color: var(--bg-tertiary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-s);

  .empty-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(var(--fg-accent-color-rgb), 0.1);
    color: var(--fg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    margin-bottom: 8px;
  }

  .empty-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin-bottom: 4px;
  }

  .empty-subtitle {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    max-width: 280px;
    line-height: 1.3;
    margin-bottom: 12px;
  }

  .empty-actions-row {
    display: flex;
    gap: 6px;
  }

  .empty-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--r-xs);
    border: 1px solid var(--fg-accent-color);
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      opacity: 0.9;
    }

    &.secondary {
      background-color: transparent;
      border-color: var(--border-secondary-color);
      color: var(--fg-primary-color);

      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
  }
}

.map-wrapper {
  min-width: 0;
  flex-grow: 1;
}
</style>
