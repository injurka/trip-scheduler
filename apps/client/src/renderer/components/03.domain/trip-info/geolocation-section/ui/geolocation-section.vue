<script setup lang="ts">
import type { useGeolocationMap } from '../composables/use-geolocation-map'
import type { ActivitySectionGeolocation, Coordinate, MapPoint, MapRoute } from '../models/types'
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw, watch } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
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
const mapController = shallowRef<ReturnType<typeof useGeolocationMap>>()
let unsubDragEnd: (() => void) | null = null

const activeView = ref<'points' | 'routes'>(
  (!props.section?.points || props.section.points.length === 0) && (props.section?.routes && props.section.routes.length > 0)
    ? 'routes'
    : 'points',
)
const activeRouteId = ref<string | null>(null)
const isMapFullscreen = ref(false)
const isPanelVisible = ref(false)
const searchQuery = ref('')
const routePointType = ref<'via' | 'connect'>('via')

interface SelectedLocationState {
  coords: Coordinate
  address?: string
  isFetchingAddress: boolean
}
const selectedLocation = ref<SelectedLocationState | null>(null)

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
  isLoading: isRoutesLoading,
  createNewRoute,
  addPointToRoute,
  deleteRoute,
  deletePointFromRoute,
  updatePointInRoute,
  handlePointDataUpdate: handleRoutePointUpdate,
  refreshRoutePointAddress,
  setInitialRoutes,
  setRouteTransportMode,
} = useGeolocationRoutes(mapController)

const debouncedUpdate = useDebounceFn(() => {
  if (!isInitialized.value)
    return

  const map = mapController.value?.mapInstance.value
  const currentCenter = map?.getCenter()
  const currentZoom = map?.getZoom()

  emit('updateSection', {
    ...props.section,
    points: toRaw(points.value),
    routes: toRaw(routes.value),
    center: currentCenter ? [currentCenter.lng, currentCenter.lat] : props.section.center,
    zoom: currentZoom !== undefined ? Math.round(currentZoom) : props.section.zoom,
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
    if (r.points.length > 1) {
      if (index === 0)
        type = 'start'
      else if (index === r.points.length - 1 && p.type !== 'connect')
        type = 'end'
      else if (p.type !== 'connect')
        type = 'via'
    }
    else {
      type = 'start'
    }

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
  return [37.6176, 55.7558]
})

async function handleMapClick(coords: Coordinate) {
  if (props.readonly)
    return

  if (mode.value === 'add_route_point') {
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
    selectedLocation.value = null
  }
  else {
    selectedLocation.value = {
      coords,
      isFetchingAddress: false,
    }
    if (isMapFullscreen.value) {
      isPanelVisible.value = true
    }
  }
}

async function handleCreatePoiFromSelection() {
  if (!selectedLocation.value)
    return
  await addPoiPoint(selectedLocation.value.coords)
  selectedLocation.value = null
  activeView.value = 'points'
}

async function handleStartRouteFromSelection() {
  if (!selectedLocation.value)
    return
  const newRoute = await createNewRoute(selectedLocation.value.coords)
  if (newRoute) {
    activeRouteId.value = newRoute.id
    activeView.value = 'routes'
    mode.value = 'add_route_point'
  }
  selectedLocation.value = null
}

async function handleAddToActiveRouteFromSelection() {
  if (!selectedLocation.value || !activeRouteId.value)
    return
  await addPointToRoute(activeRouteId.value, selectedLocation.value.coords, routePointType.value)
  selectedLocation.value = null
}

async function handleFetchAddressForSelection() {
  if (!selectedLocation.value || !mapController.value)
    return
  selectedLocation.value.isFetchingAddress = true
  const info = await mapController.value.fetchAddress(selectedLocation.value.coords)
  selectedLocation.value.isFetchingAddress = false
  if (info?.address) {
    selectedLocation.value.address = info.address
  }
  else {
    useToast().error('Адрес не найден.')
  }
}

function handleCenterOnSelection() {
  if (!selectedLocation.value)
    return
  mapController.value?.flyToLocation(selectedLocation.value.coords[0], selectedLocation.value.coords[1])
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
  selectedLocation.value = null
}

function handleRouteUpdate(route: MapRoute) {
  const pointRouteIndex = routes.value.findIndex(r => r.id === route.id)
  if (pointRouteIndex !== -1) {
    const prevMode = routes.value[pointRouteIndex].transportMode
    routes.value[pointRouteIndex] = { ...routes.value[pointRouteIndex], ...route }
    if (route.transportMode && route.transportMode !== prevMode) {
      setRouteTransportMode(route.id, route.transportMode)
    }
  }
}

function setActiveRoute(routeId: string | null) {
  activeRouteId.value = routeId
  if (routeId)
    mode.value = 'add_route_point'
  else
    mode.value = 'pan'
  selectedLocation.value = null
}

async function handleToggleFullscreen() {
  if (!sectionContainerRef.value)
    return

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    }
    catch {
      isMapFullscreen.value = false
    }
  }
  else if (isMapFullscreen.value) {
    isMapFullscreen.value = false
  }
  else {
    try {
      if (document.fullscreenEnabled && sectionContainerRef.value.requestFullscreen) {
        await sectionContainerRef.value.requestFullscreen()
      }
      else {
        isMapFullscreen.value = true
      }
    }
    catch {
      isMapFullscreen.value = true
    }
  }
  nextTick(() => {
    mapController.value?.mapInstance.value?.resize()
  })
}

function handleFullscreenChange() {
  isMapFullscreen.value = document.fullscreenElement === sectionContainerRef.value
  nextTick(() => {
    mapController.value?.mapInstance.value?.resize()
  })
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMapFullscreen.value && !document.fullscreenElement) {
    isMapFullscreen.value = false
    nextTick(() => {
      mapController.value?.mapInstance.value?.resize()
    })
  }
}

async function onMapReady(controller: ReturnType<typeof useGeolocationMap>) {
  mapController.value = controller
  setInitialPoints(props.section.points)
  await setInitialRoutes(props.section.routes)

  unsubDragEnd = controller.onPointDragEnd((pointId, newCoords) => {
    if (points.value.some(p => p.id === pointId))
      movePoiPoint(pointId, newCoords)
    else
      updatePointInRoute(pointId, newCoords, false)
  })

  isInitialized.value = true
  if ((!points.value || points.value.length === 0) && routes.value && routes.value.length > 0) {
    activeView.value = 'routes'
  }

  watch([points, routes], debouncedUpdate, { deep: true })
}

watch(
  () => [props.readonly, points.value.length, routes.value.length],
  () => {
    if (props.readonly && points.value.length === 0 && routes.value.length > 0 && activeView.value === 'points') {
      activeView.value = 'routes'
    }
  },
  { immediate: true },
)

watch(activeView, () => {
  mode.value = 'pan'
  activeRouteId.value = null
  selectedLocation.value = null
})

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (unsubDragEnd) {
    unsubDragEnd()
    unsubDragEnd = null
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    ref="sectionContainerRef"
    class="geolocation-section"
    :class="{ 'is-fullscreen': isMapFullscreen, 'is-editing': !readonly }"
  >
    <div
      v-show="(!readonly || points.length > 0 || routes.length > 0) && (!isMapFullscreen || isPanelVisible)"
      class="main-panel"
      :class="{ 'fullscreen-panel': isMapFullscreen }"
    >
      <!-- Шапка панели в полноэкранном режиме с кнопкой закрытия -->
      <div v-if="isMapFullscreen" class="fullscreen-panel-header">
        <div class="fullscreen-panel-title">
          <Icon
            :icon="activeView === 'points' ? 'mdi:map-marker-multiple-outline' : 'mdi:directions'"
            class="panel-title-icon"
          />
          <span>{{ activeView === 'points' ? 'Точки на карте' : 'Маршруты' }}</span>
        </div>
        <button
          type="button"
          class="fullscreen-panel-close-btn"
          title="Скрыть панель"
          aria-label="Скрыть панель"
          @click="isPanelVisible = false"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <!-- Верхний тулбар: Поиск и переключение табов -->
      <div v-if="!readonly || (points.length > 0 && routes.length > 0)" class="geo-top-toolbar">
        <div v-if="!readonly" class="search-input-wrapper">
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
            <span class="tab-count">{{ routes.length }}</span>
          </button>
        </div>
      </div>

      <!-- ПОСТОЯННАЯ КАРТОЧКА ТОЧКИ: Фиксированная высота, без скачков контента -->
      <div v-if="!readonly" class="selected-point-card" :class="{ 'is-active': !!selectedLocation }">
        <!-- Верхняя строка: Координаты + адрес / текст-подсказка -->
        <div class="point-info-row">
          <div class="info-content">
            <template v-if="selectedLocation">
              <Icon icon="mdi:map-marker-radius" class="status-icon active" />
              <span class="coord-badge">
                {{ selectedLocation.coords[1].toFixed(5) }}, {{ selectedLocation.coords[0].toFixed(5) }}
              </span>
              <span v-if="selectedLocation.address" class="address-snippet" :title="selectedLocation.address">
                {{ selectedLocation.address }}
              </span>
            </template>
            <template v-else>
              <Icon icon="mdi:cursor-default-click-outline" class="status-icon idle" />
              <span class="idle-hint">Кликните по карте для выбора точки</span>
            </template>
          </div>

          <button
            v-if="selectedLocation"
            type="button"
            class="clear-selection-btn"
            title="Снять выбор"
            @click="selectedLocation = null"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>

        <!-- Нижняя строка: Кнопки действий (всегда на месте, активируются по клику) -->
        <div class="point-actions-row">
          <button
            type="button"
            class="action-chip primary"
            :disabled="!selectedLocation"
            @click="handleCreatePoiFromSelection"
          >
            <Icon icon="mdi:map-marker-plus" />
            <span>Метка</span>
          </button>

          <button
            type="button"
            class="action-chip"
            :disabled="!selectedLocation"
            @click="handleStartRouteFromSelection"
          >
            <Icon icon="mdi:directions-fork" />
            <span>Маршрут</span>
          </button>

          <button
            v-if="activeRouteId"
            type="button"
            class="action-chip"
            :disabled="!selectedLocation"
            @click="handleAddToActiveRouteFromSelection"
          >
            <Icon icon="mdi:plus-circle-outline" />
            <span>В маршрут</span>
          </button>

          <button
            type="button"
            class="action-chip secondary"
            :disabled="!selectedLocation || selectedLocation.isFetchingAddress || !!selectedLocation.address"
            @click="handleFetchAddressForSelection"
          >
            <Icon
              :icon="selectedLocation?.isFetchingAddress ? 'mdi:loading' : 'mdi:map-marker-question-outline'"
              :class="{ spin: selectedLocation?.isFetchingAddress }"
            />
            <span>{{ selectedLocation?.address ? 'Адрес найден' : 'Адрес' }}</span>
          </button>

          <button
            type="button"
            class="action-chip secondary icon-only"
            title="Центрировать карту"
            :disabled="!selectedLocation"
            @click="handleCenterOnSelection"
          >
            <Icon icon="mdi:crosshairs" />
          </button>
        </div>
      </div>

      <!-- Активные баннеры системных режимов (перемещение точки / запись маршрута) -->
      <div v-if="!readonly" class="geo-actions-toolbar">
        <div v-if="mode === 'move_point'" class="active-banner move-banner">
          <span class="banner-text">
            <Icon icon="mdi:cursor-move" />
            Кликните на карте новое место для точки
          </span>
          <button type="button" class="banner-cancel-btn" @click="mode = 'pan'; pointToMoveId = null">
            Отмена
          </button>
        </div>

        <div v-else-if="activeRouteId" class="active-banner route-edit-banner">
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
      </div>

      <!-- Списки точек / маршрутов -->
      <div class="lists-container">
        <template v-if="activeView === 'points'">
          <div v-if="points.length === 0" class="empty-state-card">
            <div class="empty-icon-wrap">
              <Icon icon="mdi:map-marker-outline" />
            </div>
            <div class="empty-title">
              Нет добавленных точек
            </div>
            <div class="empty-subtitle">
              Кликните на карту в нужном месте, затем нажмите «Метка» в карточке выше
            </div>
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

        <template v-if="activeView === 'routes'">
          <div v-if="routes.length === 0" class="empty-state-card">
            <div class="empty-icon-wrap">
              <Icon icon="mdi:routes" />
            </div>
            <div class="empty-title">
              Маршруты не созданы
            </div>
            <div class="empty-subtitle">
              Кликните на карту и нажмите «Маршрут» для старта трека
            </div>
          </div>

          <GeolocationRouteList
            v-else
            :routes="routes"
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
      :mode="mode"
      :center="mapCenter"
      :height="height"
      :is-loading="isLoading"
      :zoom="section.zoom"
      :readonly="readonly"
      :is-fullscreen="isMapFullscreen"
      :interactive-on-click="true"
      :selected-coords="selectedLocation?.coords || null"
      @map-ready="onMapReady"
      @map-click="handleMapClick"
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

  &.is-editing {
    padding: 6px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
  }

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

    .map-wrapper {
      height: 100%;
    }
  }
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  &.fullscreen-panel {
    position: absolute;
    left: calc(12px + var(--safe-area-inset-left));
    top: calc(12px + var(--safe-area-inset-top));
    bottom: calc(12px + var(--safe-area-inset-bottom));
    z-index: 1001;
    width: 380px;
    max-width: calc(100% - 80px);
    box-sizing: border-box;
    padding: 12px;
    border-radius: var(--r-m);
    box-shadow: var(--s-l);
    border: 1px solid var(--border-primary-color);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    background-color: rgba(var(--bg-primary-color-rgb), 0.95);
    overflow: hidden;

    .lists-container {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
    }

    @media (max-width: 640px) {
      left: calc(8px + var(--safe-area-inset-left));
      right: calc(8px + var(--safe-area-inset-right));
      width: auto;
      max-width: none;
      top: auto;
      bottom: calc(8px + var(--safe-area-inset-bottom));
      max-height: calc(52vh - var(--safe-area-inset-bottom));
      max-height: calc(52dvh - var(--safe-area-inset-bottom));
      padding: 10px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    }
  }
}

.fullscreen-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;

  .fullscreen-panel-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--fg-primary-color);

    .panel-title-icon {
      font-size: 1.15rem;
      color: var(--fg-accent-color);
    }
  }

  .fullscreen-panel-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-xs);
    border: none;
    background-color: transparent;
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 1.15rem;
    transition: all 0.15s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
  }
}

.geo-top-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
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

/* Карточка выбранной точки: стабильная структура */
.selected-point-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 74px;
  padding: 8px 10px;
  gap: 6px;
  flex-shrink: 0;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-sizing: border-box;

  &.is-active {
    border-color: var(--fg-accent-color);
    box-shadow: var(--s-xs);
  }

  .point-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 22px;

    .info-content {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    .status-icon {
      font-size: 1.1rem;
      flex-shrink: 0;

      &.active {
        color: var(--fg-accent-color);
      }

      &.idle {
        color: var(--fg-tertiary-color);
      }
    }

    .coord-badge {
      font-family: var(--font-mono, monospace);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      background: var(--bg-secondary-color);
      padding: 1px 6px;
      border-radius: var(--r-2xs);
      border: 1px solid var(--border-secondary-color);
      flex-shrink: 0;
    }

    .address-snippet {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .idle-hint {
      font-size: 0.75rem;
      color: var(--fg-tertiary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .clear-selection-btn {
      border: none;
      background: transparent;
      color: var(--fg-secondary-color);
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;

      &:hover {
        color: var(--fg-primary-color);
      }
    }
  }

  .point-actions-row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }

    .action-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      height: 26px;
      border-radius: var(--r-xs);
      border: 1px solid var(--border-secondary-color);
      background-color: var(--bg-secondary-color);
      color: var(--fg-primary-color);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s ease;

      .iconify {
        font-size: 0.9rem;
        color: var(--fg-accent-color);
      }

      &:hover:not(:disabled) {
        background-color: var(--bg-hover-color);
        border-color: var(--fg-accent-color);
      }

      &.primary {
        background-color: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
        color: var(--fg-inverted-color);

        .iconify {
          color: var(--fg-inverted-color);
        }

        &:hover:not(:disabled) {
          opacity: 0.9;
        }
      }

      &.secondary {
        color: var(--fg-secondary-color);
        .iconify {
          color: var(--fg-secondary-color);
        }
      }

      &.icon-only {
        padding: 0;
        width: 26px;
        justify-content: center;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        border-color: var(--border-secondary-color) !important;
        background-color: transparent !important;
        color: var(--fg-tertiary-color) !important;

        .iconify {
          color: var(--fg-tertiary-color) !important;
        }
      }
    }
  }
}

.geo-actions-toolbar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
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

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
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
    margin-bottom: 8px;
  }
}

.map-wrapper {
  min-width: 0;
  flex-grow: 1;
}
</style>
