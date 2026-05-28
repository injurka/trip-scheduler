<script setup lang="ts">
import type { MapCity } from '../composables/use-trip-map'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { clampMapTransform, useMapFullscreen } from '../composables/use-map-fullscreen'
import { useMapRenderer } from '../composables/use-map-renderer'
import { useMapSize } from '../composables/use-map-size'
import { useTripMap } from '../composables/use-trip-map'
import { useWorldDots } from '../composables/use-world-dots'
import TripMapEmpty from './states/trip-map-empty.vue'
import TripMapError from './states/trip-map-error.vue'
import TripMapSkeleton from './states/trip-map-skeleton.vue'
import TripMapPanel from './trip-map-panel.vue'
import TripMapToolbar from './trip-map-toolbar.vue'

const route = useRoute()
const userId = computed(() => route.params.id as string)
const { cities, isLoading, fetchCities } = useTripMap(userId.value)

const { dotPath, baseProj, isBuilding, load: loadGeo, build: buildDots } = useWorldDots()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const { draw, cancelPending } = useMapRenderer(canvasRef, cities)

const {
  isFullscreen,
  mapT,
  isDragging,
  reset: resetTransform,
  toggle: fsToggle,
  onFsChange,
  applyWheel,
  startDrag,
  applyDrag,
  endDrag,
  startTouch,
  applyTouch,
  endTouch,
} = useMapFullscreen()

const containerRef = ref<HTMLDivElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)
const showCityList = ref(false)
const panelRef = ref<InstanceType<typeof TripMapPanel> | null>(null)
const geoError = ref(false)

const hoveredCity = ref<MapCity | null>(null)
const selectedCity = ref<MapCity | null>(null)
let dragStartCoords = { x: 0, y: 0 }

const { cssW, cssH, apply: applySize, centerScroll, observe, disconnect } = useMapSize(
  scrollRef,
  canvasRef,
  isFullscreen,
  (w, h) => {
    buildDots(w, h)
    redraw()
  },
)

const grouped = computed(() => {
  const m = new Map<string, typeof cities.value>()
  for (const c of cities.value) {
    const k = c.country || 'Неизвестно'
    if (!m.has(k))
      m.set(k, [])
    m.get(k)!.push(c)
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'ru'))
})

const isMapDirty = computed(() => {
  return Math.abs(mapT.scale - 1) > 0.01 || Math.abs(mapT.tx) > 0.5 || Math.abs(mapT.ty) > 0.5
})

function pluralize(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11)
    return 'место'
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 11 && n % 100 <= 14))
    return 'места'
  return 'мест'
}

function redraw(): void {
  draw(cssW.value, cssH.value, dotPath.value, baseProj.value, mapT.scale, mapT.tx, mapT.ty, hoveredCity.value?.id, selectedCity.value?.id)
}

function handleWheel(e: WheelEvent): void {
  const target = e.target as Element
  if (target.closest('.trip-map-toolbar'))
    return
  e.preventDefault()
  applyWheel(e, cssW.value, cssH.value)
  redraw()
}

function handleMouseDown(e: MouseEvent): void {
  dragStartCoords = { x: e.clientX, y: e.clientY }
  startDrag(e, panelRef.value?.rootRef ?? null)
}

function handleGlobalMouseMove(e: MouseEvent): void {
  if (applyDrag(e, cssW.value, cssH.value)) {
    redraw()
  }
}

function handleGlobalMouseUp(): void {
  endDrag()
}

function handleTouchStart(e: TouchEvent): void {
  startTouch(e, panelRef.value?.rootRef ?? null)
}

function handleTouchMove(e: TouchEvent): void {
  if (isDragging.value) {
    e.preventDefault()
    if (applyTouch(e, cssW.value, cssH.value)) {
      redraw()
    }
  }
}

function handleTouchEnd(e: TouchEvent): void {
  endTouch(e)
}

function handleFsChange(): void {
  onFsChange(() => nextTick(applySize))
}

function handleWindowResize(): void {
  if (isFullscreen.value)
    applySize()
}

function handleToggleFullscreen(): void {
  fsToggle(containerRef.value!)
}

function resetMap() {
  resetTransform()
  selectedCity.value = null
  redraw()
}

function getCityAt(x: number, y: number): MapCity | null {
  if (!baseProj.value)
    return null
  const { scale, tx, ty } = mapT
  const w = cssW.value
  const h = cssH.value

  let bestDist = Infinity
  let bestCity: MapCity | null = null

  for (const city of cities.value) {
    const base = baseProj.value([city.lon, city.lat])
    if (!base)
      continue
    const cx = (base[0] - w / 2) * scale + w / 2 + tx
    const cy = (base[1] - h / 2) * scale + h / 2 + ty

    const dx = cx - x
    const dy = cy - y
    const dist = dx * dx + dy * dy

    if (dist < 100 && dist < bestDist) {
      bestDist = dist
      bestCity = city
    }
  }
  return bestCity
}

function handleCanvasMouseMove(e: MouseEvent) {
  if (isDragging.value || !canvasRef.value)
    return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const city = getCityAt(x, y)

  if (hoveredCity.value?.id !== city?.id) {
    hoveredCity.value = city
    redraw()
  }
}

function handleCanvasMouseLeave() {
  if (hoveredCity.value) {
    hoveredCity.value = null
    redraw()
  }
}

function handleCanvasClick(e: MouseEvent) {
  const dx = e.clientX - dragStartCoords.x
  const dy = e.clientY - dragStartCoords.y
  if (dx * dx + dy * dy > 25)
    return // Was dragged, do not trigger click

  if (!canvasRef.value)
    return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const city = getCityAt(x, y)

  if (city) {
    focusCity(city)
  }
  else {
    selectedCity.value = null
    redraw()
  }
}

function focusCity(city: MapCity) {
  selectedCity.value = city
  if (!baseProj.value)
    return

  const base = baseProj.value([city.lon, city.lat])
  if (!base)
    return

  const targetScale = 4
  const w = cssW.value
  const h = cssH.value

  const targetTx = (w / 2 - base[0]) * targetScale
  const targetTy = (h / 2 - base[1]) * targetScale

  mapT.scale = targetScale
  const clamped = clampMapTransform(targetScale, targetTx, targetTy, w, h)
  mapT.tx = clamped.tx
  mapT.ty = clamped.ty

  redraw()
}

function getCityScreenCoords(city: MapCity | null) {
  if (!city || !baseProj.value)
    return { display: 'none' }
  const base = baseProj.value([city.lon, city.lat])
  if (!base)
    return { display: 'none' }
  const { scale, tx, ty } = mapT
  const cx = (base[0] - cssW.value / 2) * scale + cssW.value / 2 + tx
  const cy = (base[1] - cssH.value / 2) * scale + cssH.value / 2 + ty
  return {
    left: `${cx}px`,
    top: `${cy}px`,
    transform: 'translate(-50%, -100%)',
    marginTop: '-12px',
  }
}

const hoverStyle = computed(() => getCityScreenCoords(hoveredCity.value))
const popoverStyle = computed(() => getCityScreenCoords(selectedCity.value))

async function loadGeoJson(): Promise<void> {
  geoError.value = false
  try {
    await loadGeo()
  }
  catch (e) {
    console.error('[TripMapView] GeoJSON load error:', e)
    geoError.value = true
  }
}

onMounted(async () => {
  await fetchCities()
  await loadGeoJson()

  observe()
  window.addEventListener('resize', handleWindowResize)

  scrollRef.value?.addEventListener('wheel', handleWheel, { passive: false })
  scrollRef.value?.addEventListener('touchstart', handleTouchStart, { passive: false })
  scrollRef.value?.addEventListener('touchmove', handleTouchMove, { passive: false })
  scrollRef.value?.addEventListener('touchend', handleTouchEnd, { passive: false })
  scrollRef.value?.addEventListener('touchcancel', handleTouchEnd, { passive: false })

  document.addEventListener('fullscreenchange', handleFsChange)
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)

  applySize()
  centerScroll()
})

onUnmounted(() => {
  cancelPending()
  disconnect()
  window.removeEventListener('resize', handleWindowResize)

  scrollRef.value?.removeEventListener('wheel', handleWheel)
  scrollRef.value?.removeEventListener('touchstart', handleTouchStart)
  scrollRef.value?.removeEventListener('touchmove', handleTouchMove)
  scrollRef.value?.removeEventListener('touchend', handleTouchEnd)
  scrollRef.value?.removeEventListener('touchcancel', handleTouchEnd)

  document.removeEventListener('fullscreenchange', handleFsChange)
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

watch(cities, redraw)
watch(dotPath, redraw)
</script>

<template>
  <div
    ref="containerRef"
    class="trip-map"
    :class="{
      'trip-map-fs': isFullscreen,
    }"
  >
    <div
      ref="scrollRef"
      class="trip-map-scroll"
      @mousedown="handleMouseDown"
    >
      <TripMapSkeleton v-if="isLoading || isBuilding" />

      <TripMapError
        v-else-if="geoError"
        message="Не удалось загрузить карту мира"
        @retry="loadGeoJson"
      />

      <template v-else>
        <!-- Canvas Wrapper / Stage -->
        <div
          class="trip-map-stage"
          :class="{ 'is-hovering': hoveredCity, 'is-dragging': isDragging }"
          :style="{ width: `${cssW}px`, height: `${cssH}px`, margin: '0 auto' }"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
          @click="handleCanvasClick"
        >
          <canvas ref="canvasRef" class="trip-map-canvas" />

          <!-- Overlays -->
          <div v-if="hoveredCity && hoveredCity.id !== selectedCity?.id" class="trip-map-tooltip" :style="hoverStyle">
            {{ hoveredCity.name }}
          </div>

          <div v-if="selectedCity" class="trip-map-popover" :style="popoverStyle" @click.stop>
            <div class="popover-header">
              <span class="popover-title">{{ selectedCity.name }}</span>
              <button class="popover-close" @click.stop="selectedCity = null; redraw()">
                <Icon icon="mdi:close" width="16" height="16" />
              </button>
            </div>
            <div class="popover-body">
              {{ selectedCity.country }}
            </div>
          </div>
        </div>

        <TripMapEmpty v-if="cities.length === 0" />

        <div v-if="cities.length > 0" class="trip-map-badge">
          {{ cities.length }}&nbsp;{{ pluralize(cities.length) }}
        </div>

        <Transition name="fade">
          <div v-if="isFullscreen" class="trip-map-hint">
            Колесо — приближение · Перетащи — перемещение
          </div>
        </Transition>
      </template>
    </div>

    <template v-if="!isLoading && !isBuilding && !geoError">
      <TripMapToolbar
        :show-list="showCityList"
        :is-fullscreen="isFullscreen"
        :has-cities="cities.length > 0"
        :show-reset="isMapDirty"
        @toggle-list="showCityList = !showCityList"
        @toggle-fullscreen="handleToggleFullscreen"
        @reset="resetMap"
      />

      <TripMapPanel
        ref="panelRef"
        v-model:open="showCityList"
        :cities="cities"
        :grouped="grouped"
        @city-click="focusCity"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.trip-map {
  width: 100%;
  height: 500px;

  &-fs {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    border: none;
    background: var(--bg-primary-color);
    z-index: 50;
  }
}

.trip-map-scroll {
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .trip-map-fs & {
    overflow: hidden;
  }
}

.trip-map-stage {
  position: relative;
  display: block;
  cursor: default;

  &.is-hovering {
    cursor: pointer;
  }

  &.is-dragging {
    cursor: grabbing;
  }

  .trip-map-fs & {
    cursor: grab;

    &.is-hovering {
      cursor: pointer;
    }

    &.is-dragging {
      cursor: grabbing;
    }
  }
}

.trip-map-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.trip-map-tooltip {
  position: absolute;
  background: rgba(var(--bg-primary-color-rgb), 0.9);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);
  padding: 4px 8px;
  border-radius: var(--r-s);
  font-size: 0.75rem;
  font-weight: 500;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  box-shadow: var(--s-s);
  transition:
    transform 0.1s ease-out,
    top 0.1s ease-out,
    left 0.1s ease-out;
}

.trip-map-popover {
  position: absolute;
  background: rgba(var(--bg-secondary-color-rgb), 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  min-width: 160px;
  z-index: 20;
  box-shadow: var(--s-m);
  display: flex;
  flex-direction: column;
  transition:
    transform 0.1s ease-out,
    top 0.1s ease-out,
    left 0.1s ease-out;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.popover-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.popover-close {
  cursor: pointer;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
  background: transparent;
  border: none;
  padding: 2px;
  margin-right: -4px;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.popover-body {
  padding: 8px 12px;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.trip-map-badge {
  position: absolute;
  bottom: 12px;
  right: 16px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  background: rgba(var(--bg-secondary-color-rgb), 0.85);
  padding: 4px 10px;
  border-radius: var(--r-full);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border-secondary-color);
  pointer-events: none;
  user-select: none;
}

.trip-map-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.72rem;
  color: var(--fg-secondary-color);
  background: rgba(var(--bg-secondary-color-rgb), 0.82);
  padding: 4px 14px;
  border-radius: var(--r-full);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border-secondary-color);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@include media-down(sm) {
  .trip-map-hint {
    display: none;
  }
}
</style>
