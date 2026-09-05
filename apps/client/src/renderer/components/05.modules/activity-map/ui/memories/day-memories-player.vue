<script setup lang="ts">
// «Воспоминания дня»: карта OL + сплайн-маршрут с окраской по активности + таймлайн-плеер.
// Данные: tRPC tracking.getDay (точки и сегменты дня, UTC).
import type PointGeom from 'ol/geom/Point'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { Feature } from 'ol'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { AppRouteNames } from '~/shared/constants/routes'
import { catmullRomSpline } from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

const props = withDefaults(defineProps<{
  dayUtc?: string
  showBackButton?: boolean
}>(), {
  showBackButton: true,
})

const route = useRoute()
const router = useRouter()

const todayUtc = new Date().toISOString().slice(0, 10)
const selectedDay = ref(props.dayUtc || (route.query.day as string) || todayUtc)
const t = ref(0)
const isPlaying = ref(false)

interface DayData {
  points: Array<{
    clientPointId: string
    tsUtc: number
    lat: number
    lng: number
    speed: number | null
    accuracy: number | null
    activity: ActivityType
    sessionId: string
  }>
  segments: Array<{
    id: string
    sessionId: string
    activity: ActivityType
    confidence: number
    startedAt: number
    endedAt: number
    distanceM: number
    pointCount: number
    geometry: [number, number][]
  }>
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  still: '#9e9e9e',
  walk: '#4caf50',
  bike: '#ff9800',
  vehicle: '#2196f3',
  rail: '#9c27b0',
  unknown: '#607d8b',
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  unknown: 'Движение',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  unknown: 'mdi:crosshairs-question',
}

const isLoading = ref(true)
const dayData = ref<DayData | null>(null)
const loadError = ref<string | null>(null)

async function loadDay(targetDay: string) {
  isLoading.value = true
  loadError.value = null
  try {
    dayData.value = await (trpc as any).tracking.getDay.query({ dayUtc: targetDay })
  }
  catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    isLoading.value = false
  }
}

watch(
  () => props.dayUtc,
  (val) => {
    if (val && val !== selectedDay.value) {
      selectedDay.value = val
    }
  },
)

watch(
  () => route.query.day,
  (val) => {
    if (typeof val === 'string' && val !== selectedDay.value) {
      selectedDay.value = val
    }
  },
)

watch(
  selectedDay,
  (day) => {
    t.value = 0
    isPlaying.value = false
    void loadDay(day)
  },
  { immediate: true },
)

function changeDay(offset: number) {
  const cur = new Date(`${selectedDay.value}T12:00:00Z`)
  cur.setUTCDate(cur.getUTCDate() + offset)
  const nextStr = cur.toISOString().slice(0, 10)
  if (nextStr > todayUtc)
    return
  selectedDay.value = nextStr
  if (route.name === AppRouteNames.ActivityMap) {
    router.replace({ query: { ...route.query, day: nextStr } })
  }
}

function goToToday() {
  selectedDay.value = todayUtc
  if (route.name === AppRouteNames.ActivityMap) {
    router.replace({ query: { ...route.query, day: todayUtc } })
  }
}

function handleBack() {
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push({ name: AppRouteNames.ActivityTracking })
  }
}

function formatHeaderDay(dayStr: string): string {
  if (dayStr === todayUtc)
    return 'Сегодня'
  const d = new Date(`${dayStr}T12:00:00Z`)
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
}

// ─── Сегменты для рендера: серверные (классифицированные) или сырые точки ────
interface RenderSegment {
  activity: ActivityType
  points: Array<{ tsUtc: number, lat: number, lng: number }>
  t0: number
  t1: number
}

const renderSegments = computed<RenderSegment[]>(() => {
  const d = dayData.value
  if (!d)
    return []
  if (d.segments.length > 0) {
    return d.segments.map(s => ({
      activity: s.activity,
      points: s.geometry.map(([lng, lat], i) => ({
        tsUtc: s.startedAt + (i / Math.max(1, s.geometry.length - 1)) * (s.endedAt - s.startedAt),
        lat,
        lng,
      })),
      t0: s.startedAt,
      t1: s.endedAt,
    }))
  }
  // Fallback: группировка сырых точек по активности
  const out: RenderSegment[] = []
  let cur: RenderSegment | null = null
  for (const p of d.points) {
    if (cur && cur.activity === p.activity) {
      cur.points.push(p)
      cur.t1 = p.tsUtc
    }
    else {
      cur = { activity: p.activity, points: [p], t0: p.tsUtc, t1: p.tsUtc }
      out.push(cur)
    }
  }
  return out
})

const totalPointsCount = computed(() => dayData.value?.points.length ?? 0)

// ─── Карта ────────────────────────────────────────────────────────────────────
const mapHost = ref<HTMLElement | null>(null)
const popupHost = ref<HTMLElement | null>(null)
const { mapInstance, isMapReady, initMap } = useKitMap()
const routeSource = shallowRef(new VectorSource())
const markerFeature = shallowRef<Feature<PointGeom> | null>(null)
const mapCenter: [number, number] = [37.6176, 55.7558]

onMounted(async () => {
  if (!mapHost.value || !popupHost.value)
    return
  await initMap(mapHost.value!, popupHost.value!, { center: mapCenter, zoom: 11 })
  mapInstance.value?.addLayer(new VectorLayer({ source: routeSource.value, zIndex: 5 }))

  markerFeature.value = new Feature({ geometry: new Point(fromLonLat(mapCenter)) })
  markerFeature.value.setStyle(new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#4caf50' }),
      stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
    }),
  }))
  routeSource.value.addFeature(markerFeature.value)

  watch(isMapReady, (ready) => {
    if (ready)
      rebuildFeatures()
  }, { immediate: true })
})

function fitTrackBounds() {
  if (renderSegments.value.length === 0)
    return
  const ext = routeSource.value.getExtent()
  if (ext && ext.some(v => v !== Number.POSITIVE_INFINITY && v !== Number.NEGATIVE_INFINITY)) {
    mapInstance.value?.getView().fit(ext, { padding: [60, 60, 140, 60], maxZoom: 16, duration: 600 })
  }
}

function rebuildFeatures() {
  routeSource.value.clear()
  if (markerFeature.value) {
    routeSource.value.addFeature(markerFeature.value)
  }

  for (const seg of renderSegments.value) {
    const smooth = catmullRomSpline(
      seg.points.map(p => ({ lat: p.lat, lng: p.lng })),
      6,
    )
    if (smooth.length < 2)
      continue
    const feature = new Feature(new LineString(smooth.map(p => fromLonLat([p.lng, p.lat]))))
    feature.setStyle(new Style({
      stroke: new Stroke({
        color: ACTIVITY_COLORS[seg.activity],
        width: seg.activity === 'rail' ? 6 : 4,
        lineCap: 'round',
      }),
    }))
    routeSource.value.addFeature(feature)
  }

  if (renderSegments.value.length > 0) {
    fitTrackBounds()
  }
}

watch(renderSegments, rebuildFeatures)

onBeforeUnmount(() => {
  mapInstance.value?.setTarget(undefined)
})

// ─── Таймлайн-плеер ───────────────────────────────────────────────────────────
const dayStart = computed(() => renderSegments.value.length > 0
  ? Math.min(...renderSegments.value.map(s => s.t0))
  : 0)
const dayEnd = computed(() => renderSegments.value.length > 0
  ? Math.max(...renderSegments.value.map(s => s.t1))
  : 0)

let raf = 0
let lastTs = 0

// Скорости воспроизведения: 1x, 2x, 5x, 10x
const speedMultiplier = ref<number>(2)
const SPEED_BASE = 150 // базовая скорость

function tick(ts: number) {
  if (lastTs !== 0) {
    const delta = (ts - lastTs) * SPEED_BASE * speedMultiplier.value
    t.value = Math.min(t.value + delta, dayEnd.value)
    if (t.value >= dayEnd.value)
      isPlaying.value = false
  }
  lastTs = ts
  if (isPlaying.value)
    raf = requestAnimationFrame(tick)
}

watch(isPlaying, (playing) => {
  lastTs = 0
  if (playing) {
    if (t.value >= dayEnd.value)
      t.value = dayStart.value
    raf = requestAnimationFrame(tick)
  }
  else {
    cancelAnimationFrame(raf)
  }
})

onBeforeUnmount(() => cancelAnimationFrame(raf))

watch(dayStart, (v) => {
  if (t.value === 0 && v > 0)
    t.value = v
})

const currentSegment = computed(() =>
  renderSegments.value.find(s => t.value >= s.t0 && t.value <= s.t1)
  ?? renderSegments.value[0],
)

const currentPoint = computed(() => {
  const seg = currentSegment.value
  if (!seg || seg.points.length === 0)
    return null
  let p = seg.points[0]
  for (const q of seg.points) {
    if (q.tsUtc <= t.value)
      p = q
    else break
  }
  return p
})

watch(currentPoint, (p) => {
  if (p && markerFeature.value) {
    markerFeature.value.getGeometry()?.setCoordinates(fromLonLat([p.lng, p.lat]))
    if (currentSegment.value) {
      const color = ACTIVITY_COLORS[currentSegment.value.activity]
      markerFeature.value.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
        }),
      }))
    }
  }
})

const timeLabel = computed(() =>
  t.value > 0
    ? new Date(t.value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })
    : '--:--',
)

const speedKmhFromPoints = computed(() => {
  const seg = currentSegment.value
  if (!seg || seg.points.length < 2)
    return null
  const pts = seg.points
  let i = 0
  for (let j = 1; j < pts.length; j++) {
    if (pts[j].tsUtc <= t.value)
      i = j
  }
  const a = pts[Math.max(0, i - 1)]
  const b = pts[i]
  const dtH = (b.tsUtc - a.tsUtc) / 3_600_000
  if (dtH <= 0)
    return null
  const R = 6_371_000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const a2 = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  const dM = 2 * R * Math.asin(Math.sqrt(a2))
  return dM / 1000 / dtH
})

function fmtRange(ms: number) {
  return ms > 0
    ? new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : '--:--'
}
</script>

<template>
  <div class="memories-player">
    <!-- Верхняя плавающая панель навигации по дням -->
    <div class="top-nav-bar">
      <KitBtn
        v-if="props.showBackButton"
        variant="tonal"
        size="sm"
        class="nav-btn back-btn"
        @click="handleBack"
      >
        <template #prepend>
          <Icon icon="mdi:arrow-left" />
        </template>
        Назад
      </KitBtn>

      <div class="day-picker-group">
        <button
          class="day-arrow-btn"
          aria-label="Предыдущий день"
          @click="changeDay(-1)"
        >
          <Icon icon="mdi:chevron-left" />
        </button>

        <div class="day-current">
          <Icon icon="mdi:calendar-month-outline" class="cal-icon" />
          <span class="day-text">{{ formatHeaderDay(selectedDay) }}</span>
          <span v-if="selectedDay === todayUtc" class="today-chip">Сегодня</span>
        </div>

        <button
          class="day-arrow-btn"
          aria-label="Следующий день"
          :disabled="selectedDay >= todayUtc"
          @click="changeDay(1)"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>

      <div class="top-actions">
        <KitBtn
          v-if="selectedDay !== todayUtc"
          variant="subtle"
          size="xs"
          @click="goToToday"
        >
          Сегодня
        </KitBtn>

        <KitBtn
          variant="tonal"
          size="sm"
          title="Центрировать трек на карте"
          :disabled="renderSegments.length === 0"
          @click="fitTrackBounds"
        >
          <template #prepend>
            <Icon icon="mdi:crosshairs-gps" />
          </template>
          Трек
        </KitBtn>
      </div>
    </div>

    <!-- Карта OpenLayers -->
    <div ref="mapHost" class="memories-map" />
    <div ref="popupHost" class="memories-popup" />

    <!-- Оверлей загрузки -->
    <div v-if="isLoading" class="memories-overlay">
      <div class="overlay-card">
        <Icon icon="mdi:loading" class="spin overlay-icon" />
        <span>Загрузка данных дня…</span>
      </div>
    </div>

    <!-- Оверлей ошибки -->
    <div v-else-if="loadError" class="memories-overlay">
      <div class="overlay-card is-error">
        <Icon icon="mdi:alert-circle-outline" class="overlay-icon" />
        <span>{{ loadError }}</span>
        <KitBtn size="xs" variant="outlined" @click="loadDay(selectedDay)">
          Повторить
        </KitBtn>
      </div>
    </div>

    <!-- Пустое состояние для дня без треков -->
    <div
      v-else-if="renderSegments.length === 0"
      class="empty-track-overlay"
    >
      <div class="empty-card">
        <div class="empty-icon-wrap">
          <Icon icon="mdi:map-marker-off-outline" class="icon" />
        </div>
        <h3>Нет маршрута за этот день</h3>
        <p>В этот день координаты не сохранялись или устройство находилось в покое.</p>
        <div class="empty-actions">
          <KitBtn
            v-if="selectedDay !== todayUtc"
            variant="tonal"
            size="sm"
            @click="goToToday"
          >
            Перейти к сегодняшнему дню
          </KitBtn>
          <KitBtn
            variant="outlined"
            size="sm"
            @click="router.push({ name: AppRouteNames.ActivityTracking })"
          >
            К списку активности
          </KitBtn>
        </div>
      </div>
    </div>

    <!-- Нижняя панель плеера -->
    <div v-if="renderSegments.length > 0" class="memories-panel">
      <div class="memories-readout">
        <div class="readout-time-group">
          <span class="time">{{ timeLabel }}</span>
          <span class="time-tz">UTC</span>
        </div>

        <div
          v-if="currentSegment"
          class="activity-badge"
          :style="{
            backgroundColor: `${ACTIVITY_COLORS[currentSegment.activity]}20`,
            color: ACTIVITY_COLORS[currentSegment.activity],
            borderColor: `${ACTIVITY_COLORS[currentSegment.activity]}40`,
          }"
        >
          <Icon :icon="ACTIVITY_ICONS[currentSegment.activity]" />
          <span>{{ ACTIVITY_LABELS[currentSegment.activity] }}</span>
        </div>

        <div v-if="speedKmhFromPoints !== null" class="speed-badge">
          <Icon icon="mdi:speedometer" />
          <span>{{ speedKmhFromPoints.toFixed(0) }} км/ч</span>
        </div>

        <div class="track-stats-right">
          <span class="points-count">{{ totalPointsCount }} точек</span>
        </div>
      </div>

      <!-- Ползунок таймлайна -->
      <div class="slider-container">
        <input
          v-model.number="t"
          class="memories-slider"
          type="range"
          :min="dayStart"
          :max="dayEnd"
          step="1000"
          :disabled="dayEnd === 0"
        >
      </div>

      <!-- Кнопки управления воспроизведением -->
      <div class="memories-actions">
        <div class="playback-controls">
          <button
            class="control-btn"
            aria-label="В начало дня"
            title="В начало"
            @click="t = dayStart"
          >
            <Icon icon="mdi:skip-backward" />
          </button>

          <button
            class="control-btn play-btn"
            :disabled="dayEnd === 0"
            :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
            :title="isPlaying ? 'Пауза' : 'Воспроизведение'"
            @click="isPlaying = !isPlaying"
          >
            <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" />
          </button>

          <button
            class="control-btn"
            aria-label="В конец дня"
            title="В конец"
            @click="t = dayEnd"
          >
            <Icon icon="mdi:skip-forward" />
          </button>
        </div>

        <!-- Переключатель множителя скорости -->
        <div class="speed-selector">
          <button
            v-for="s in [1, 2, 5, 10]"
            :key="s"
            class="speed-chip"
            :class="{ 'is-active': speedMultiplier === s }"
            @click="speedMultiplier = s"
          >
            {{ s }}x
          </button>
        </div>

        <div class="time-range-display">
          <span class="range">{{ fmtRange(dayStart) }} – {{ fmtRange(dayEnd) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-player {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .memories-map {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .memories-popup {
    display: none;
  }
}

.top-nav-bar {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  .day-picker-group {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-full);
    padding: 4px 10px;
    box-shadow: var(--s-m);

    .day-arrow-btn {
      width: 28px;
      height: 28px;
      border-radius: var(--r-full);
      border: none;
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.16);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    .day-current {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 6px;

      .cal-icon {
        font-size: 1.1rem;
        color: var(--primary, #4caf50);
      }

      .day-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--fg-color, #fff);
        text-transform: capitalize;
      }

      .today-chip {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 0.68rem;
        font-weight: 600;
        background: rgba(76, 175, 80, 0.2);
        color: #81c784;
      }
    }
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.memories-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  z-index: 15;

  .overlay-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--s-l);
    color: var(--fg-primary-color);

    .overlay-icon {
      font-size: 1.5rem;
    }

    &.is-error {
      color: #ef5350;
      flex-direction: column;
    }
  }
}

.empty-track-overlay {
  position: absolute;
  inset: 70px 14px 14px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;

  .empty-card {
    pointer-events: auto;
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    padding: 24px;
    max-width: 380px;
    text-align: center;
    box-shadow: var(--s-l);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--r-full);
      background-color: var(--bg-tertiary-color);
      display: flex;
      align-items: center;
      justify-content: center;

      .icon {
        font-size: 1.8rem;
        opacity: 0.6;
      }
    }

    h3 {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: var(--fg-primary-color);
    }

    p {
      font-size: 0.82rem;
      line-height: 1.4;
      margin: 0;
      color: var(--fg-secondary-color);
    }

    .empty-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}

.memories-panel {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  z-index: 20;
  background-color: var(--bg-secondary-color);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--s-l);

  .memories-readout {
    display: flex;
    align-items: center;
    gap: 12px;
    font-variant-numeric: tabular-nums;

    .readout-time-group {
      display: flex;
      align-items: baseline;
      gap: 4px;

      .time {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--fg-color, #fff);
      }

      .time-tz {
        font-size: 0.7rem;
        color: var(--fg-secondary-color, rgba(255, 255, 255, 0.5));
      }
    }

    .activity-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid;
    }

    .speed-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.82rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.8));
    }

    .track-stats-right {
      margin-left: auto;
      font-size: 0.78rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
    }
  }

  .slider-container {
    width: 100%;
    display: flex;
    align-items: center;

    .memories-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      outline: none;
      accent-color: var(--primary, #4caf50);
      cursor: pointer;
    }
  }

  .memories-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .playback-controls {
      display: flex;
      align-items: center;
      gap: 8px;

      .control-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: var(--fg-color, #fff);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        transition:
          background 0.2s,
          transform 0.1s;

        &:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.16);
        }

        &:active:not(:disabled) {
          transform: scale(0.95);
        }

        &.play-btn {
          width: 42px;
          height: 42px;
          background: var(--primary, #4caf50);
          color: #fff;
          font-size: 1.3rem;

          &:hover:not(:disabled) {
            background: #43a047;
          }
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    .speed-selector {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.06);
      padding: 3px;
      border-radius: 20px;

      .speed-chip {
        padding: 2px 8px;
        border-radius: 14px;
        font-size: 0.72rem;
        font-weight: 600;
        border: none;
        background: transparent;
        color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
        cursor: pointer;
        transition: all 0.2s;

        &.is-active {
          background: rgba(255, 255, 255, 0.2);
          color: var(--fg-color, #fff);
        }
      }
    }

    .time-range-display {
      font-size: 0.8rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.65));
      font-variant-numeric: tabular-nums;
    }
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
