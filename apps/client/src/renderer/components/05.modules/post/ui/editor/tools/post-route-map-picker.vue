<script setup lang="ts">
import type { Coordinate, MapPoint, MapRoute, PointType } from '~/components/03.domain/trip-info/geolocation-section'
import { Icon } from '@iconify/vue'
import Polyline from '@mapbox/polyline'
import { toLonLat } from 'ol/proj'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'

export interface EditorRoutePoint {
  lat: number
  lng: number
  label?: string
  address?: string
}

interface Props {
  visible: boolean
  initialPoints?: EditorRoutePoint[]
  transport: 'walk' | 'transit' | 'car'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', data: { points: EditorRoutePoint[], geometry: Coordinate[], distanceMeters: number }): void
}>()

const OSRM_PROFILES = {
  walk: 'routed-foot/route/v1/foot',
  transit: 'routed-bike/route/v1/bicycle',
  car: 'routed-car/route/v1/driving',
}

const isLoading = ref(false)
const mapPoints = ref<MapPoint[]>([])
const mapRoutes = ref<MapRoute[]>([])
const distanceMeters = ref(0)
const routeGeometry = ref<Coordinate[]>([])
const isSidebarVisible = ref(true)

let mapController: any = null

const mapCenter = computed<Coordinate>(() => {
  if (mapPoints.value.length > 0)
    return mapPoints.value[0].coordinates
  return [37.6173, 55.7558] // Москва
})

function onMapReady(ctrl: any) {
  mapController = ctrl
  ctrl.modifyInteraction.on('modifyend', async (event: any) => {
    const feature = event.features.getArray()[0]
    if (!feature)
      return
    const pointId = feature.getId() as string
    const newCoords = toLonLat(feature.getGeometry().getCoordinates()) as Coordinate

    const targetPoint = mapPoints.value.find(p => p.id === pointId)
    if (targetPoint) {
      isLoading.value = true
      targetPoint.coordinates = newCoords
      const address = await fetchAddress(newCoords[0], newCoords[1])
      targetPoint.address = address
      targetPoint.comment = address

      await buildRoute()
      isLoading.value = false
    }
  })
}

async function fetchAddress(lon: number, lat: number) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ru`)
    const data = await res.json()
    return data.address?.road ? `${data.address.road}${data.address.house_number ? `, ${data.address.house_number}` : ''}` : data.name || 'Точка на карте'
  }
  catch {
    return 'Точка'
  }
}

function updatePointTypes() {
  if (mapPoints.value.length === 1) {
    mapPoints.value[0].type = 'start'
  }
  else if (mapPoints.value.length > 1) {
    mapPoints.value.forEach((p, idx) => {
      if (idx === 0)
        p.type = 'start'
      else if (idx === mapPoints.value.length - 1)
        p.type = 'end'
      else p.type = 'via'
    })
  }
}

async function buildRoute() {
  if (mapPoints.value.length < 2) {
    mapRoutes.value = []
    routeGeometry.value = []
    distanceMeters.value = 0
    return
  }

  isLoading.value = true
  const coords = mapPoints.value.map(p => `${p.coordinates[0]},${p.coordinates[1]}`).join(';')
  const profile = OSRM_PROFILES[props.transport] || OSRM_PROFILES.walk

  try {
    const res = await fetch(`https://routing.openstreetmap.de/${profile}/${coords}?overview=full&geometries=polyline`)
    const data = await res.json()

    if (data.code === 'Ok' && data.routes?.length > 0) {
      const route = data.routes[0]
      const decoded = Polyline.decode(route.geometry).map(([lat, lon]: [number, number]) => [lon, lat]) as Coordinate[]

      routeGeometry.value = decoded
      distanceMeters.value = route.distance

      mapRoutes.value = [{
        id: 'temp-route',
        title: 'Маршрут',
        points: mapPoints.value,
        geometry: decoded,
        color: '#4363D8',
        isVisible: true,
        isDirect: false,
      }]
    }
    else {
      routeGeometry.value = mapPoints.value.map(p => p.coordinates)
      distanceMeters.value = 0
      mapRoutes.value = [{
        id: 'temp-route',
        title: 'Прямая',
        points: mapPoints.value,
        geometry: routeGeometry.value,
        color: '#E6194B',
        isVisible: true,
        isDirect: true,
      }]
    }
  }
  catch (e) {
    console.error('Routing failed', e)
  }
  finally {
    isLoading.value = false
  }
}

async function handleMapClick(coords: [number, number]) {
  isLoading.value = true
  const [lon, lat] = coords
  const address = await fetchAddress(lon, lat)

  mapPoints.value.push({
    id: uuidv4(),
    coordinates: [lon, lat],
    type: 'via',
    address,
    comment: address,
  })

  updatePointTypes()
  await buildRoute()
  isLoading.value = false
}

async function removePoint(index: number) {
  mapPoints.value = mapPoints.value.filter((_, i) => i !== index)
  updatePointTypes()
  await buildRoute()
}

function clearPoints() {
  mapPoints.value = []
  mapRoutes.value = []
  routeGeometry.value = []
  distanceMeters.value = 0
}

function handleConfirm() {
  if (mapPoints.value.length === 0) {
    emit('update:visible', false)
    return
  }

  const exportPoints = mapPoints.value.map(p => ({
    lat: p.coordinates[1],
    lng: p.coordinates[0],
    label: p.address,
    address: p.address,
  }))

  emit('confirm', {
    points: exportPoints,
    geometry: routeGeometry.value,
    distanceMeters: distanceMeters.value,
  })
  emit('update:visible', false)
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    if (props.initialPoints && props.initialPoints.length > 0) {
      mapPoints.value = props.initialPoints.map((p, idx) => ({
        id: uuidv4(),
        coordinates: [p.lng, p.lat] as Coordinate,
        type: (idx === 0 ? 'start' : idx === props.initialPoints!.length - 1 ? 'end' : 'via') as PointType,
        address: p.label || p.address || '',
        comment: p.label || p.address || '',
      }))
      buildRoute()
    }
    else {
      clearPoints()
    }
    isSidebarVisible.value = true
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Построить маршрут"
    :max-width="900"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="picker-layout" :class="{ 'sidebar-hidden': !isSidebarVisible }">
      <div v-show="isSidebarVisible" class="sidebar">
        <div class="sidebar-header">
          <h3>Точки маршрута</h3>
          <KitBtn
            icon="mdi:chevron-left"
            size="xs"
            variant="subtle"
            title="Скрыть панель"
            @click="isSidebarVisible = false"
          />
        </div>

        <div class="hints">
          <Icon icon="mdi:gesture-tap" />
          <span>Кликните на карту, чтобы добавить точку, или перетяните существующую.</span>
        </div>

        <div class="points-list">
          <div v-if="mapPoints.length === 0" class="empty-list">
            Нет добавленных точек
          </div>
          <div
            v-for="(point, idx) in mapPoints"
            :key="point.id"
            class="point-item"
          >
            <div class="point-number" :class="point.type">
              {{ idx + 1 }}
            </div>
            <div class="point-info">
              <span class="point-address" :title="point.address">{{ point.address }}</span>
            </div>
            <button class="remove-btn" @click="removePoint(idx)">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </div>

        <div class="stats-box">
          <span>Дистанция: {{ distanceMeters > 1000 ? `${(distanceMeters / 1000).toFixed(1)} км` : `${Math.round(distanceMeters)} м` }}</span>
        </div>
      </div>

      <div class="map-area">
        <button
          v-if="!isSidebarVisible"
          class="show-sidebar-btn"
          title="Показать точки маршрута"
          @click="isSidebarVisible = true"
        >
          <Icon icon="mdi:chevron-right" />
        </button>

        <GeolocationMap
          :points="mapPoints"
          :routes="mapRoutes"
          :drawn-routes="[]"
          mode="add_route_point"
          :center="mapCenter"
          height="100%"
          :is-loading="isLoading"
          :readonly="false"
          :is-fullscreen="false"
          :disable-context-menu="true"
          :with-search-control="true"
          @map-ready="onMapReady"
          @map-click="handleMapClick"
        />
      </div>
    </div>

    <div class="picker-footer">
      <KitBtn variant="text" :disabled="mapPoints.length === 0" @click="clearPoints">
        Очистить всё
      </KitBtn>
      <div class="actions">
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn :disabled="mapPoints.length === 0 && (initialPoints?.length ?? 0) > 0" @click="handleConfirm">
          Готово
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.picker-layout {
  display: flex;
  height: 65vh;
  min-height: 400px;
  gap: 16px;
  margin-top: 8px;

  &.sidebar-hidden {
    .map-area {
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    height: 75vh;
  }
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px;
  overflow: hidden;

  @media (max-width: 768px) {
    width: 100%;
    max-height: 40%;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .kit-btn {
    margin-right: -8px;
  }
}

.map-area {
  flex: 1;
  min-width: 0;
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-tertiary-color);
}

.show-sidebar-btn {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 10;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: none;
  color: var(--fg-primary-color);
  width: 24px;
  height: 48px;
  border-radius: 0 var(--r-s) var(--r-s) 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  .iconify {
    font-size: 20px;
  }

  @media (max-width: 768px) {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 48px;
    height: 24px;
    border-radius: 0 0 var(--r-s) var(--r-s);
    border-top: none;
    border-left: 1px solid var(--border-secondary-color);

    .iconify {
      transform: rotate(90deg);
    }
  }
}

.hints {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--bg-tertiary-color);
  padding: 8px;
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  line-height: 1.3;

  .iconify {
    font-size: 1.2rem;
    flex-shrink: 0;
    color: var(--fg-accent-color);
  }
}

.points-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.empty-list {
  text-align: center;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
  margin-top: 20px;
}

.point-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 6px 8px;
  border-radius: var(--r-s);

  &:hover {
    border-color: var(--border-primary-color);
    .remove-btn {
      opacity: 1;
    }
  }
}

.point-number {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;

  &.start {
    background: var(--fg-success-color);
  }
  &.end {
    background: var(--fg-error-color);
  }
  &.via {
    background: #f1c40f;
    color: black;
  }
}

.point-info {
  flex: 1;
  min-width: 0;
}

.point-address {
  display: block;
  font-size: 0.85rem;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  padding: 2px;
  opacity: 0.5;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-error-color);
    opacity: 1;
  }
}

.stats-box {
  background: var(--bg-tertiary-color);
  padding: 8px;
  border-radius: var(--r-s);
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
}

.picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  margin-top: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
