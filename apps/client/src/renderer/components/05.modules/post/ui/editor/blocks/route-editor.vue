<script setup lang="ts">
import type { RouteBlock } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import Polyline from '@mapbox/polyline'
import { computed, ref } from 'vue'
import { KitInput } from '~/components/01.kit/kit-input'
import PostRouteMapPicker from '../tools/post-route-map-picker.vue'

export interface EditorRoutePoint {
  lat: number
  lng: number
  label?: string
  address?: string
}

const props = defineProps<{
  block: RouteBlock
}>()

const emit = defineEmits<{
  (e: 'update', payload: Partial<RouteBlock> & { points?: EditorRoutePoint[], geometry?: [number, number][], distanceMeters?: number }): void
}>()

const isMapOpen = ref(false)

const transportIcons: Record<string, string> = {
  walk: 'mdi:walk',
  transit: 'mdi:bus',
  car: 'mdi:car',
}

const blockPoints = computed<EditorRoutePoint[]>(() => {
  return Array.isArray((props.block as any).points) ? (props.block as any).points : []
})

function calculateTimeAndDist(distMeters: number, transport: string) {
  const speeds: Record<string, number> = { walk: 5000, transit: 20000, car: 50000 }
  const speed = speeds[transport] || 5000
  const mins = Math.round((distMeters / speed) * 60)

  let distStr = ''
  if (distMeters > 1000)
    distStr = `${(distMeters / 1000).toFixed(1)} км`
  else distStr = `${Math.round(distMeters)} м`

  let durStr = ''
  if (mins < 60) {
    durStr = `${mins} мин`
  }
  else {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    durStr = m > 0 ? `${h} ч ${m} мин` : `${h} ч`
  }

  return { distance: distStr, duration: durStr }
}

async function fetchOSRMRoute(points: EditorRoutePoint[], transport: string) {
  if (points.length < 2)
    return

  const OSRM_PROFILES = {
    walk: 'routed-foot/route/v1/foot',
    transit: 'routed-bike/route/v1/bicycle',
    car: 'routed-car/route/v1/driving',
  }

  const profile = OSRM_PROFILES[transport as keyof typeof OSRM_PROFILES] || OSRM_PROFILES.walk
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';')

  try {
    const res = await fetch(`https://routing.openstreetmap.de/${profile}/${coords}?overview=full&geometries=polyline`)
    const data = await res.json()

    if (data.code === 'Ok' && data.routes?.length > 0) {
      const route = data.routes[0]
      const decoded = Polyline.decode(route.geometry).map(([lat, lng]) => [lng, lat]) as [number, number][]
      const distMeters = route.distance
      const { distance, duration } = calculateTimeAndDist(distMeters, transport)

      emit('update', {
        geometry: decoded,
        distanceMeters: distMeters,
        distance,
        duration,
      })
    }
    else {
      emit('update', {
        geometry: points.map(p => [p.lng, p.lat]),
        distanceMeters: 0,
        distance: '',
        duration: '',
      })
    }
  }
  catch (e) {
    console.error('Failed to refetch route', e)
  }
}

async function toggleTransport() {
  const modes: RouteBlock['transport'][] = ['walk', 'transit', 'car']
  const currentIdx = modes.indexOf(props.block.transport || 'walk')
  const nextMode = modes[(currentIdx + 1) % modes.length]

  // 1. Сразу обновляем иконку
  emit('update', { transport: nextMode })

  // 2. Делаем запрос к OSRM с новым профилем и обновляем геометрию
  if (blockPoints.value.length >= 2) {
    await fetchOSRMRoute(blockPoints.value, nextMode)
  }
}

function updatePointLabel(index: number, newLabel: string) {
  const currentPts = [...blockPoints.value]
  if (currentPts[index]) {
    currentPts[index].label = newLabel
    emit('update', { points: currentPts })
  }
}

async function removePoint(index: number) {
  const currentPts = [...blockPoints.value]
  currentPts.splice(index, 1)

  emit('update', { points: currentPts })

  if (currentPts.length >= 2) {
    await fetchOSRMRoute(currentPts, props.block.transport || 'walk')
  }
  else {
    emit('update', { geometry: [], distance: '', duration: '', distanceMeters: 0 })
  }
}

async function swapPoints() {
  if (blockPoints.value.length < 2)
    return

  const reversedPts = [...blockPoints.value].reverse()

  emit('update', { points: reversedPts })

  await fetchOSRMRoute(reversedPts, props.block.transport || 'walk')
}

function onMapConfirm(data: { points: EditorRoutePoint[], geometry: [number, number][], distanceMeters: number }) {
  const { points, geometry, distanceMeters } = data
  const { distance, duration } = calculateTimeAndDist(distanceMeters, props.block.transport || 'walk')

  emit('update', {
    points,
    geometry,
    distanceMeters,
    distance,
    duration,
  })
}
</script>

<template>
  <div class="route-editor">
    <div class="route-header">
      <button class="transport-btn" :title="block.transport" @click="toggleTransport">
        <Icon :icon="transportIcons[block.transport || 'walk']" />
      </button>
      <div class="route-summary">
        <span>Многоточечный маршрут</span>
      </div>
      <button class="map-action-btn" @click="isMapOpen = true">
        <Icon icon="mdi:map" />
        <span>Редактировать на карте</span>
      </button>
    </div>

    <!-- Вьювер списка точек -->
    <div class="points-list">
      <template v-if="blockPoints.length === 0">
        <div class="empty-points">
          Точки не добавлены. Откройте карту, чтобы построить маршрут.
        </div>
      </template>

      <template v-else>
        <div v-for="(point, idx) in blockPoints" :key="idx" class="point-item-wrapper">
          <div class="point-row">
            <div class="dot" :class="{ start: idx === 0, end: idx === blockPoints.length - 1 && idx > 0, via: idx > 0 && idx < blockPoints.length - 1 }" />
            <KitInput
              :model-value="point.label"
              placeholder="Название точки"
              size="sm"
              class="bare-input"
              @update:model-value="val => updatePointLabel(idx, val as string)"
            />
            <button class="remove-pt-btn" @click="removePoint(idx)">
              <Icon icon="mdi:close" />
            </button>
          </div>
          <div v-if="idx < blockPoints.length - 1" class="connector" />
        </div>
      </template>
    </div>

    <!-- Реверс маршрута -->
    <div v-if="blockPoints.length >= 2" class="reverse-action">
      <button class="swap-btn" @click="swapPoints">
        <Icon icon="mdi:swap-vertical" /> <span>Реверс маршрута</span>
      </button>
    </div>

    <div class="meta-inputs">
      <div class="meta-field">
        <Icon icon="mdi:map-marker-distance" />
        <input
          :value="block.distance"
          placeholder="Расстояние (1.5 км)"
          @input="e => emit('update', { distance: (e.target as HTMLInputElement).value })"
        >
      </div>
      <div class="meta-field">
        <Icon icon="mdi:clock-outline" />
        <input
          :value="block.duration"
          placeholder="Время (20 мин)"
          @input="e => emit('update', { duration: (e.target as HTMLInputElement).value })"
        >
      </div>
    </div>

    <PostRouteMapPicker
      v-model:visible="isMapOpen"
      :initial-points="blockPoints"
      :transport="block.transport || 'walk'"
      @confirm="onMapConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.route-editor {
  background: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  padding: 12px;
  border: 1px solid var(--border-secondary-color);
}

.route-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.transport-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-accent-color);
  font-size: 1.1rem;
  flex-shrink: 0;

  &:hover {
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }
}

.route-summary {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.map-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--fg-accent-color-rgb), 0.1);
  color: var(--fg-accent-color);
  border: 1px solid transparent;
  padding: 6px 12px;
  border-radius: var(--r-s);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: var(--fg-accent-color);
    color: white;
  }
}

.points-list {
  display: flex;
  flex-direction: column;
  padding-left: 12px;
}

.empty-points {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  font-style: italic;
  padding: 8px 0;
}

.point-item-wrapper {
  display: flex;
  flex-direction: column;
}

.point-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.start {
    background: var(--fg-success-color);
  }
  &.end {
    background: var(--fg-error-color);
  }
  &.via {
    background: #f1c40f;
  }
}

.connector {
  width: 2px;
  height: 14px;
  background: var(--border-secondary-color);
  margin-left: 4px;
  margin-top: 2px;
  margin-bottom: 2px;
}

.bare-input :deep(input) {
  background: transparent;
  border-color: transparent;
  padding-left: 0;
  font-size: 0.95rem;
  font-weight: 500;
  &:focus {
    border-color: var(--border-accent-color);
  }
}

.remove-pt-btn {
  background: none;
  border: none;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  padding: 4px;
  opacity: 0.5;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-error-color);
    opacity: 1;
  }
}

.reverse-action {
  padding-left: 12px;
  margin-top: 8px;
}

.swap-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fg-secondary-color);
  background: none;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 0;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.meta-inputs {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-secondary-color);
}

.meta-field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  flex: 1;

  input {
    background: transparent;
    border: none;
    color: var(--fg-primary-color);
    width: 100%;
    font-size: 0.9rem;
    &:focus {
      outline: none;
      border-bottom: 1px solid var(--fg-accent-color);
    }
    &::placeholder {
      color: var(--fg-tertiary-color);
    }
  }
}
</style>
