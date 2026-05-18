<script setup lang="ts">
import { useMapFullscreen } from '../composables/use-map-fullscreen'
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
  toggle: fsToggle,
  onFsChange,
  applyWheel,
  startDrag,
  applyDrag,
  endDrag,
} = useMapFullscreen()

const containerRef = ref<HTMLDivElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)
const showCityList = ref(false)
const panelRef = ref<InstanceType<typeof TripMapPanel> | null>(null)
const geoError = ref(false)

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

function pluralize(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11)
    return 'место'
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 11 && n % 100 <= 14))
    return 'места'
  return 'мест'
}

function redraw(): void {
  draw(cssW.value, cssH.value, dotPath.value, baseProj.value, mapT.scale, mapT.tx, mapT.ty)
}

function handleWheel(e: WheelEvent): void {
  if (!isFullscreen.value)
    return
  const target = e.target as Element
  if (target.closest('.trip-map-toolbar'))
    return
  e.preventDefault()
  applyWheel(e, cssW.value, cssH.value)
  redraw()
}

function handleMouseDown(e: MouseEvent): void {
  startDrag(e, panelRef.value?.rootRef ?? null)
}

function handleGlobalMouseMove(e: MouseEvent): void {
  if (applyDrag(e))
    redraw()
}

function handleGlobalMouseUp(): void {
  endDrag()
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
      'trip-map-drag': isDragging,
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
        <canvas ref="canvasRef" class="trip-map-canvas" />

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
        @toggle-list="showCityList = !showCityList"
        @toggle-fullscreen="handleToggleFullscreen"
      />

      <TripMapPanel
        ref="panelRef"
        v-model:open="showCityList"
        :cities="cities"
        :grouped="grouped"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.trip-map {
  position: relative;
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

  &-drag &-canvas {
    cursor: grabbing !important;
  }
}

.trip-map-scroll {
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .trip-map-fs & {
    overflow: hidden;
  }
}

.trip-map-canvas {
  display: block;
  margin: 0 auto;

  .trip-map-fs & {
    cursor: grab;
  }
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
</style>
