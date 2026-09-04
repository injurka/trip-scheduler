<script setup lang="ts">
// «Воспоминания дня»: карта OL + сплайн-маршрут с окраской по активности + таймлайн-плеер.
// Данные: tRPC tracking.getDay (точки и сегменты дня, UTC).
import type PointGeom from 'ol/geom/Point'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Feature } from 'ol'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { catmullRomSpline } from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

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
  unknown: '—',
}

const isLoading = ref(true)
const dayData = ref<DayData | null>(null)
const loadError = ref<string | null>(null)

async function loadDay() {
  isLoading.value = true
  loadError.value = null
  try {
    const dayUtc = new Date().toISOString().slice(0, 10)
    dayData.value = await (trpc as any).tracking.getDay.query({ dayUtc })
  }
  catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadDay()
})

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
      radius: 7,
      fill: new Fill({ color: '#e91e63' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  }))
  routeSource.value.addFeature(markerFeature.value)

  watch(isMapReady, (ready) => {
    if (ready)
      rebuildFeatures()
  }, { immediate: true })
})

function rebuildFeatures() {
  routeSource.value.clear()
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
    const ext = routeSource.value.getExtent()
    if (ext && ext.some(v => v !== Number.POSITIVE_INFINITY && v !== Number.NEGATIVE_INFINITY)) {
      mapInstance.value?.getView().fit(ext, { padding: [40, 40, 40, 40], maxZoom: 16 })
    }
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

const t = ref(0)
const isPlaying = ref(false)
let raf = 0
let lastTs = 0
const SPEEDUP = 300 // 1 c реального времени = 5 мин трека

function tick(ts: number) {
  if (lastTs !== 0) {
    t.value = Math.min(t.value + (ts - lastTs) * SPEEDUP, dayEnd.value)
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
  if (p && markerFeature.value)
    markerFeature.value.getGeometry()?.setCoordinates(fromLonLat([p.lng, p.lat]))
})

const timeLabel = computed(() =>
  t.value > 0
    ? new Date(t.value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
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
    <div ref="mapHost" class="memories-map" />
    <div ref="popupHost" class="memories-popup" />

    <div v-if="isLoading" class="memories-overlay">
      Загрузка дня…
    </div>
    <div v-else-if="loadError" class="memories-overlay">
      {{ loadError }}
    </div>

    <div class="memories-panel">
      <div class="memories-readout">
        <span class="time">{{ timeLabel }}</span>
        <span
          v-if="currentSegment"
          class="activity"
          :style="{ color: ACTIVITY_COLORS[currentSegment.activity] }"
        >
          {{ ACTIVITY_LABELS[currentSegment.activity] }}
        </span>
        <span v-if="speedKmhFromPoints !== null" class="speed">
          {{ speedKmhFromPoints.toFixed(0) }} км/ч
        </span>
      </div>

      <input
        v-model.number="t"
        class="memories-slider"
        type="range"
        :min="dayStart"
        :max="dayEnd"
        step="1000"
        :disabled="dayEnd === 0"
      >

      <div class="memories-actions">
        <button aria-label="В начало" @click="t = dayStart">
          <Icon icon="mdi:skip-backward" />
        </button>
        <button
          class="play"
          :disabled="dayEnd === 0"
          :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
          @click="isPlaying = !isPlaying"
        >
          <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" />
        </button>
        <button aria-label="В конец" @click="t = dayEnd">
          <Icon icon="mdi:skip-forward" />
        </button>
        <span class="range">{{ fmtRange(dayStart) }} – {{ fmtRange(dayEnd) }}</span>
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

  .memories-map {
    flex: 1;
    min-height: 0;
  }

  .memories-popup {
    display: none; // заглушка для Overlay kit-map
  }

  .memories-overlay {
    position: absolute;
    inset: 0 0 120px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
  }

  .memories-panel {
    background: var(--surface, #1e1e1e);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .memories-readout {
      display: flex;
      gap: 16px;
      align-items: baseline;
      font-variant-numeric: tabular-nums;

      .time {
        font-size: 1.2rem;
        font-weight: 600;
      }
    }

    .memories-slider {
      width: 100%;
      accent-color: var(--primary, #e91e63);
    }

    .memories-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .play {
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }

      .range {
        margin-left: auto;
        opacity: 0.7;
        font-size: 0.85rem;
      }
    }
  }
}
</style>
