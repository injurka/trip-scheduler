<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useMapFullscreen } from '../composables/use-map-fullscreen'
import { useMapRenderer } from '../composables/use-map-renderer'
import { useTripMap } from '../composables/use-trip-map'
import { useWorldDots } from '../composables/use-world-dots'

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

const wrapperRef = ref<HTMLDivElement | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)
const showCityList = ref(false)

const MIN_H = 320
let cssW = 0
let cssH = 0
let resizeOb: ResizeObserver | null = null

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

function applySize(): void {
  const canvas = canvasRef.value
  const wrapper = wrapperRef.value
  if (!canvas || !wrapper)
    return

  const dpr = window.devicePixelRatio || 1
  cssW = isFullscreen.value ? window.innerWidth : wrapper.clientWidth
  cssH = isFullscreen.value ? window.innerHeight : Math.max(Math.round(cssW * 0.5), MIN_H)

  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  buildDots(cssW, cssH)
  redraw()
}

function redraw(): void {
  draw(cssW, cssH, dotPath.value, baseProj.value, mapT.scale, mapT.tx, mapT.ty)
}

function handleWheel(e: WheelEvent): void {
  if (!isFullscreen.value)
    return
  if (panelRef.value?.contains(e.target as Node))
    return
  e.preventDefault()
  applyWheel(e, cssW, cssH)
  redraw()
}

function handleMouseDown(e: MouseEvent): void {
  startDrag(e, panelRef.value)
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

onMounted(async () => {
  await fetchCities()

  try {
    await loadGeo()
  }
  catch (e) {
    console.error('[TripMapView] GeoJSON load error:', e)
    return
  }

  resizeOb = new ResizeObserver(applySize)
  wrapperRef.value && resizeOb.observe(wrapperRef.value)

  wrapperRef.value?.addEventListener('wheel', handleWheel, { passive: false })
  document.addEventListener('fullscreenchange', handleFsChange)
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)

  applySize()
})

onUnmounted(() => {
  cancelPending()
  resizeOb?.disconnect()
  wrapperRef.value?.removeEventListener('wheel', handleWheel)
  document.removeEventListener('fullscreenchange', handleFsChange)
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

watch(cities, redraw)
watch(dotPath, redraw)
</script>

<template>
  <div
    ref="wrapperRef"
    class="trip-map"
    :class="{
      'trip-map--fs': isFullscreen,
      'trip-map--drag': isDragging,
    }"
    @mousedown="handleMouseDown"
  >
    <!-- ── Скелетон ─────────────────────────────────────────────────────────── -->
    <div v-if="isLoading || isBuilding" class="trip-map__skeleton" />

    <template v-else>
      <canvas ref="canvasRef" class="trip-map__canvas" />

      <div v-if="cities.length === 0" class="trip-map__empty">
        <span class="trip-map__empty-icon">🗺️</span>
        <p class="trip-map__empty-text">
          Добавьте впечатление с координатами —<br>оно появится на карте
        </p>
      </div>

      <div class="trip-map__tl">
        <button
          v-if="cities.length > 0"
          class="map-btn"
          :class="{ 'map-btn--active': showCityList }"
          :aria-label="showCityList ? 'Скрыть список' : 'Список мест'"
          @click.stop="showCityList = !showCityList"
        >
          <Icon
            :icon="showCityList ? 'mdi:format-list-bulleted-square' : 'mdi:format-list-bulleted'"
            width="18"
            height="18"
          />
        </button>
      </div>

      <div class="trip-map__tr">
        <button
          class="map-btn"
          :aria-label="isFullscreen ? 'Выйти из полноэкранного режима' : 'Открыть на весь экран'"
          @click.stop="fsToggle(wrapperRef!)"
        >
          <Icon
            :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
            width="18"
            height="18"
          />
        </button>
      </div>

      <Transition name="city-panel">
        <div
          v-if="showCityList && cities.length > 0"
          ref="panelRef"
          class="trip-map__panel"
          @click.stop
          @mousedown.stop
        >
          <div class="panel-head">
            <span class="panel-title">Посещённые места</span>
            <button
              class="panel-close"
              aria-label="Закрыть"
              @click="showCityList = false"
            >
              <Icon icon="mdi:close" width="15" height="15" />
            </button>
          </div>
          <div class="panel-body">
            <template v-for="[country, list] in grouped" :key="country">
              <div class="panel-country">
                {{ country }}
              </div>
              <div
                v-for="c in list"
                :key="c.id"
                class="panel-city"
              >
                {{ c.name }}
              </div>
            </template>
          </div>
        </div>
      </Transition>

      <div v-if="cities.length > 0" class="trip-map__badge">
        {{ cities.length }}&nbsp;{{ pluralize(cities.length) }}
      </div>

      <Transition name="fade">
        <div v-if="isFullscreen" class="trip-map__hint">
          Колесо — приближение · Перетащи — перемещение
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped lang="scss">
.trip-map {
  position: relative;
  width: 100%;
  min-height: 320px;
  overflow: hidden;

  &--fs {
    border-radius: 0;
    border: none;
    background: var(--bg-primary-color);
  }

  &--drag &__canvas {
    cursor: grabbing !important;
  }
}

.trip-map__canvas {
  display: block;
  width: 100%;

  .trip-map--fs & {
    cursor: grab;
  }
}

.trip-map__skeleton {
  width: 100%;
  min-height: 320px;
  padding-top: 50%;
  background: linear-gradient(
    90deg,
    var(--bg-tertiary-color) 25%,
    var(--bg-secondary-color) 50%,
    var(--bg-tertiary-color) 75%
  );
  background-size: 200% 100%;
  animation: map-shimmer 1.5s ease-in-out infinite;
}

@keyframes map-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.trip-map__empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  pointer-events: none;
  text-align: center;
}

.trip-map__empty-icon {
  font-size: 2.5rem;
  line-height: 1;
  opacity: 0.4;
}

.trip-map__empty-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
}

.trip-map__tl,
.trip-map__tr {
  position: absolute;
  top: 10px;
  z-index: 10;
}

.trip-map__tl {
  left: 10px;
}
.trip-map__tr {
  right: 10px;
}

.map-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(var(--bg-secondary-color-rgb), 0.85);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s,
    box-shadow 0.18s;

  &:hover {
    color: var(--fg-accent-color);
    background: rgba(var(--bg-secondary-color-rgb), 0.97);
  }

  &--active {
    color: var(--fg-accent-color);
    background: rgba(var(--bg-secondary-color-rgb), 0.97);
    box-shadow: 0 0 0 2px var(--fg-accent-color);
  }
}

.trip-map__panel {
  position: absolute;
  top: 52px;
  left: 10px;
  width: 220px;
  max-height: calc(100% - 62px);
  display: flex;
  flex-direction: column;
  background: rgba(var(--bg-secondary-color-rgb), 0.94);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  z-index: 20;
  box-shadow: var(--s-m);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.panel-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  padding: 6px 0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 2px;
  }
}

.panel-country {
  padding: 8px 12px 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-accent-color);

  & ~ & {
    margin-top: 2px;
    border-top: 1px solid var(--border-secondary-color);
  }
}

.panel-city {
  padding: 5px 12px 5px 22px;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  cursor: default;
  transition:
    color 0.13s,
    background 0.13s;

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-tertiary-color);
  }
}

.trip-map__badge {
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

.trip-map__hint {
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

.city-panel-enter-active,
.city-panel-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.city-panel-enter-from,
.city-panel-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.97);
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
