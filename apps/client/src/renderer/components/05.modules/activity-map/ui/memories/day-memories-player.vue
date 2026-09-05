<script setup lang="ts">
import type PointGeom from 'ol/geom/Point'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { Feature, Overlay } from 'ol'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { AppRouteNames } from '~/shared/constants/routes'
import { deleteStoredPoint } from '~/shared/services/tracking/geotrack-client'
import {
  filterGpsOutliers,
  haversineM,
  normalizeSplineVertices,
  processDayTrack,
  splitTrackIntoLegs,
} from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

const props = withDefaults(defineProps<{
  dayUtc?: string
  showBackButton?: boolean
}>(), {
  showBackButton: true,
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'close'): void
}>()

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
    altitude?: number | null
    speed: number | null
    accuracy: number | null
    bearing?: number | null
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
    const res = await (trpc as any).tracking.getDay.query({ dayUtc: targetDay })
    if (res && Array.isArray(res.points)) {
      res.points = filterGpsOutliers(res.points)
    }
    dayData.value = res
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

const instance = getCurrentInstance()

function handleBack() {
  emit('back')
  emit('close')
  if (!instance?.vnode.props?.onBack && !instance?.vnode.props?.onClose) {
    if (window.history.length > 1) {
      router.back()
    }
    else {
      router.push({ name: AppRouteNames.ActivityTracking })
    }
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

type ViewMode = 'route' | 'points'
const viewMode = ref<ViewMode>('route')

interface SelectedPointInfo {
  point: DayData['points'][0]
  index: number
  total: number
}

const selectedPoint = ref<SelectedPointInfo | null>(null)

// ─── Карта ────────────────────────────────────────────────────────────────────
const mapHost = ref<HTMLElement | null>(null)
const popupHost = ref<HTMLElement | null>(null)
const playbackMarkerHost = ref<HTMLElement | null>(null)
const { mapInstance, isMapReady, initMap } = useKitMap()
const routeSource = shallowRef(new VectorSource())
const progressSource = shallowRef(new VectorSource())
const markerFeature = shallowRef<Feature<PointGeom> | null>(null)
const mapCenter: [number, number] = [37.6176, 55.7558]

let pointOverlay: Overlay | null = null
let playbackOverlay: Overlay | null = null

const isFollowCamera = ref(true)
const isDeletingPoint = ref(false)
const isCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function copyCoords(p: DayData['points'][0]) {
  const txt = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt)
    isCopied.value = true
    if (copyTimer)
      clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      isCopied.value = false
    }, 2000)
  }
}

function getPointStatusBadge(p: DayData['points'][0]) {
  const speed = (p.speed ?? 0) * 3.6
  if (speed > 350) {
    return { type: 'flight', icon: 'mdi:airplane', label: 'Авиаперелет / Скоростное перемещение' }
  }
  if ((p.accuracy ?? 0) > 60) {
    return { type: 'warning', icon: 'mdi:alert-outline', label: 'Низкая точность спутника' }
  }
  return { type: 'valid', icon: 'mdi:check-circle-outline', label: 'Валидная GPS-точка' }
}

function closePointPopup() {
  selectedPoint.value = null
  pointOverlay?.setPosition(undefined)
}

function formatPointTime(tsUtc: number): string {
  return new Date(tsUtc).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  })
}

async function handleDeletePoint(pt: DayData['points'][0]) {
  if (!dayData.value)
    return
  isDeletingPoint.value = true
  try {
    // 1. Запрос на сервер для удаления точки и нормализации сегментов сессии
    await (trpc as any).tracking.deletePoint.mutate({ clientPointId: pt.clientPointId })

    // 2. Удаляем из локальной очереди клиента (если еще не отправлена)
    deleteStoredPoint(pt.clientPointId)

    // 3. Удаляем из текущего массива точек
    dayData.value.points = dayData.value.points.filter(p => p.clientPointId !== pt.clientPointId)

    // 4. Мгновенная нормализация сегментов на клиенте из оставшихся точек
    const remaining = dayData.value.points
    if (remaining.length >= 2) {
      const processed = processDayTrack(remaining.map(p => ({
        clientPointId: p.clientPointId,
        tsUtc: p.tsUtc,
        lat: p.lat,
        lng: p.lng,
        altitude: p.altitude ?? null,
        accuracy: p.accuracy,
        speed: p.speed,
        bearing: p.bearing ?? null,
        activity: p.activity,
        activityConfidence: 85,
        sessionId: p.sessionId,
      })))
      dayData.value.segments = processed.map((s, idx) => ({
        id: `client-seg-${idx}`,
        sessionId: s.points[0]?.sessionId || '',
        activity: s.activity,
        confidence: s.confidence,
        startedAt: s.points[0].tsUtc,
        endedAt: s.points[s.points.length - 1].tsUtc,
        distanceM: s.features.distanceM,
        pointCount: s.points.length,
        geometry: s.points.map(p => [p.lng, p.lat] as [number, number]),
      }))
    }
    else {
      dayData.value.segments = []
    }

    closePointPopup()
    rebuildFeatures()
  }
  catch (err) {
    console.error('Ошибка удаления точки:', err)
  }
  finally {
    isDeletingPoint.value = false
  }
}

onMounted(async () => {
  if (!mapHost.value || !popupHost.value)
    return
  await initMap(mapHost.value!, popupHost.value!, { center: mapCenter, zoom: 11 })

  // Слой базового маршрута (фон и интерактивные точки)
  mapInstance.value?.addLayer(new VectorLayer({ source: routeSource.value, zIndex: 5 }))

  // Слой активного пройденного пути с подсветкой
  mapInstance.value?.addLayer(new VectorLayer({ source: progressSource.value, zIndex: 7 }))

  // Оверлей для маркера воспроизведения
  if (playbackMarkerHost.value) {
    playbackOverlay = new Overlay({
      element: playbackMarkerHost.value,
      positioning: 'center-center',
      stopEvent: false,
    })
    mapInstance.value?.addOverlay(playbackOverlay)
  }

  // Оверлей для попапа точки (с stopEvent: true чтобы клики внутри карточки не перехватывались картой!)
  if (popupHost.value) {
    pointOverlay = new Overlay({
      element: popupHost.value,
      positioning: 'bottom-center',
      offset: [0, -14],
      stopEvent: true,
      autoPan: {
        animation: { duration: 250 },
        margin: 20,
      },
    })
    mapInstance.value?.addOverlay(pointOverlay)
  }

  markerFeature.value = new Feature({ geometry: new Point(fromLonLat(mapCenter)) })
  markerFeature.value.setStyle(new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#4caf50' }),
      stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
    }),
  }))
  routeSource.value.addFeature(markerFeature.value)

  mapInstance.value?.on('click', (evt) => {
    let found = false
    mapInstance.value?.forEachFeatureAtPixel(evt.pixel, (feat) => {
      const pData = feat.get('pointData') as DayData['points'][0] | undefined
      if (pData) {
        selectedPoint.value = {
          point: pData,
          index: (feat.get('pointIndex') as number) || 1,
          total: (feat.get('totalPoints') as number) || 1,
        }
        const geom = feat.getGeometry()
        if (geom && geom instanceof Point) {
          pointOverlay?.setPosition(geom.getCoordinates())
        }
        else {
          pointOverlay?.setPosition(evt.coordinate)
        }
        found = true
        return true
      }
      return false
    }, {
      layerFilter: l => l.getZIndex() === 5 || l.getZIndex() === 7,
      hitTolerance: 6,
    })
    if (!found) {
      closePointPopup()
    }
  })

  mapInstance.value?.on('pointermove', (evt) => {
    if (evt.dragging) {
      return
    }
    const hit = mapInstance.value?.hasFeatureAtPixel(evt.pixel, {
      layerFilter: l => l.getZIndex() === 5 || l.getZIndex() === 7,
      hitTolerance: 6,
    })
    if (mapHost.value) {
      mapHost.value.style.cursor = hit ? 'pointer' : ''
    }
  })

  watch(isMapReady, (ready) => {
    if (ready)
      rebuildFeatures()
  }, { immediate: true })
})

function fitTrackBounds() {
  const pts = dayData.value?.points
  if (!pts || pts.length === 0) {
    if (renderSegments.value.length === 0)
      return
  }

  // Считаем экстент строго по реальным точкам трека, исключая дефолтный маркер Москвы
  if (pts && pts.length > 0) {
    let minLon = Number.POSITIVE_INFINITY
    let minLat = Number.POSITIVE_INFINITY
    let maxLon = Number.NEGATIVE_INFINITY
    let maxLat = Number.NEGATIVE_INFINITY
    for (const p of pts) {
      if (p.lng < minLon)
        minLon = p.lng
      if (p.lng > maxLon)
        maxLon = p.lng
      if (p.lat < minLat)
        minLat = p.lat
      if (p.lat > maxLat)
        maxLat = p.lat
    }
    const minCoord = fromLonLat([minLon, minLat])
    const maxCoord = fromLonLat([maxLon, maxLat])
    const extent: [number, number, number, number] = [minCoord[0], minCoord[1], maxCoord[0], maxCoord[1]]
    mapInstance.value?.getView().fit(extent, { padding: [60, 60, 140, 60], maxZoom: 16, duration: 600 })
    return
  }

  const ext = routeSource.value.getExtent()
  if (ext && ext.some(v => v !== Number.POSITIVE_INFINITY && v !== Number.NEGATIVE_INFINITY)) {
    mapInstance.value?.getView().fit(ext, { padding: [60, 60, 140, 60], maxZoom: 16, duration: 600 })
  }
}

function updateProgressLine() {
  progressSource.value.clear()
  if (t.value === 0 || !dayData.value?.points?.length)
    return

  const covered = dayData.value.points
    .filter(p => p.tsUtc <= t.value)
    .sort((a, b) => a.tsUtc - b.tsUtc)

  if (covered.length < 2)
    return

  const legs = splitTrackIntoLegs(covered)
  for (const leg of legs) {
    if (leg.points.length < 2)
      continue
    const smooth = normalizeSplineVertices(
      leg.points.map(p => ({ lat: p.lat, lng: p.lng })),
      6,
    )
    if (smooth.length < 2)
      continue

    const coords = smooth.map(p => fromLonLat([p.lng, p.lat]))
    const act = leg.points[leg.points.length - 1]?.activity || 'unknown'
    const color = ACTIVITY_COLORS[act] || '#2196f3'

    // Светящаяся подложка
    const glowFeat = new Feature(new LineString(coords))
    glowFeat.setStyle(new Style({
      stroke: new Stroke({
        color: `${color}40`,
        width: 8,
        lineCap: 'round',
      }),
      zIndex: 6,
    }))
    progressSource.value.addFeature(glowFeat)

    // Яркая линия прогресса
    const progressFeat = new Feature(new LineString(coords))
    progressFeat.setStyle(new Style({
      stroke: new Stroke({
        color,
        width: 4.5,
        lineCap: 'round',
      }),
      zIndex: 7,
    }))
    progressSource.value.addFeature(progressFeat)
  }
}

function rebuildFeatures() {
  routeSource.value.clear()
  progressSource.value.clear()
  closePointPopup()

  if (markerFeature.value) {
    routeSource.value.addFeature(markerFeature.value)
  }

  const rawPoints = dayData.value?.points || []
  const sorted = [...rawPoints].sort((a, b) => a.tsUtc - b.tsUtc)

  const uniquePoints: typeof sorted = []
  for (const p of sorted) {
    const prev = uniquePoints[uniquePoints.length - 1]
    if (!prev || Math.abs(prev.lat - p.lat) > 1e-6 || Math.abs(prev.lng - p.lng) > 1e-6) {
      uniquePoints.push(p)
    }
  }

  if (viewMode.value === 'route') {
    for (const seg of renderSegments.value) {
      const legs = splitTrackIntoLegs(seg.points)
      for (const leg of legs) {
        if (leg.points.length < 2)
          continue
        const smooth = normalizeSplineVertices(
          leg.points.map(p => ({ lat: p.lat, lng: p.lng })),
          6,
        )
        if (smooth.length < 2)
          continue
        const feature = new Feature(new LineString(smooth.map(p => fromLonLat([p.lng, p.lat]))))
        feature.setStyle(new Style({
          stroke: new Stroke({
            color: `${ACTIVITY_COLORS[seg.activity]}55`,
            width: seg.activity === 'rail' ? 5 : 3.5,
            lineCap: 'round',
          }),
        }))
        routeSource.value.addFeature(feature)
      }
    }
  }
  else if (viewMode.value === 'points') {
    const legs = splitTrackIntoLegs(uniquePoints)
    for (const leg of legs) {
      if (leg.points.length < 2)
        continue
      const smooth = normalizeSplineVertices(
        leg.points.map(p => ({ lat: p.lat, lng: p.lng })),
        8,
      )
      if (smooth.length < 2)
        continue
      const curveFeature = new Feature(new LineString(smooth.map(p => fromLonLat([p.lng, p.lat]))))
      curveFeature.setStyle(new Style({
        stroke: new Stroke({
          color: 'rgba(59, 130, 246, 0.45)',
          width: 3,
          lineCap: 'round',
        }),
      }))
      routeSource.value.addFeature(curveFeature)
    }
  }

  // Интерактивные маркеры для каждой точки в обоих режимах
  const isPointsMode = viewMode.value === 'points'
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]
    const ptFeature = new Feature({
      geometry: new Point(fromLonLat([p.lng, p.lat])),
    })
    ptFeature.set('pointData', p)
    ptFeature.set('pointIndex', i + 1)
    ptFeature.set('totalPoints', sorted.length)
    ptFeature.setStyle(new Style({
      image: new CircleStyle({
        radius: isPointsMode ? 5.5 : 4,
        fill: new Fill({ color: ACTIVITY_COLORS[p.activity] || '#2196f3' }),
        stroke: new Stroke({ color: '#ffffff', width: isPointsMode ? 1.5 : 1 }),
      }),
      zIndex: 20,
    }))
    routeSource.value.addFeature(ptFeature)
  }

  updateProgressLine()

  if (renderSegments.value.length > 0 || rawPoints.length > 0) {
    fitTrackBounds()
  }
}

watch([renderSegments, viewMode], () => rebuildFeatures())

onBeforeUnmount(() => {
  mapInstance.value?.setTarget(undefined)
})

// ─── Таймлайн-плеер ───────────────────────────────────────────────────────────
const dayStart = computed(() => {
  if (dayData.value?.points?.length) {
    return dayData.value.points[0].tsUtc
  }
  return renderSegments.value.length > 0
    ? Math.min(...renderSegments.value.map(s => s.t0))
    : 0
})
const dayEnd = computed(() => {
  if (dayData.value?.points?.length) {
    return dayData.value.points[dayData.value.points.length - 1].tsUtc
  }
  return renderSegments.value.length > 0
    ? Math.max(...renderSegments.value.map(s => s.t1))
    : 0
})

let raf = 0
let lastTs = 0

// Скорости воспроизведения: 1x, 2x, 5x, 10x, 20x
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

function stepSeconds(deltaSec: number) {
  t.value = Math.max(dayStart.value, Math.min(dayEnd.value, t.value + deltaSec * 1000))
}

const currentSegment = computed(() =>
  renderSegments.value.find(s => t.value >= s.t0 && t.value <= s.t1)
  ?? renderSegments.value[0],
)

const currentActivity = computed<ActivityType>(() => currentSegment.value?.activity || 'still')
const currentActivityColor = computed(() => ACTIVITY_COLORS[currentActivity.value] || '#2196f3')
const currentActivityIcon = computed(() => ACTIVITY_ICONS[currentActivity.value] || 'mdi:crosshairs-question')

const currentPoint = computed<DayData['points'][0] | null>(() => {
  const pts = dayData.value?.points
  if (!pts || pts.length === 0)
    return null

  let p = pts[0]
  for (const q of pts) {
    if (q.tsUtc <= t.value)
      p = q
    else break
  }
  return p
})

watch(currentPoint, (p) => {
  if (p) {
    const coords = fromLonLat([p.lng, p.lat])
    if (markerFeature.value) {
      markerFeature.value.getGeometry()?.setCoordinates(coords)
      const color = currentActivityColor.value
      markerFeature.value.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
        }),
      }))
    }
    if (playbackOverlay) {
      playbackOverlay.setPosition(coords)
    }
    if (isFollowCamera.value && isPlaying.value) {
      mapInstance.value?.getView().animate({
        center: coords,
        duration: 100,
      })
    }
  }
})

watch(t, () => {
  updateProgressLine()
})

const timeLabel = computed(() =>
  t.value > 0
    ? new Date(t.value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })
    : '--:--',
)

const speedKmhFromPoints = computed(() => {
  if (currentPoint.value?.speed != null && currentPoint.value.speed >= 0) {
    return currentPoint.value.speed * 3.6
  }
  const pts = dayData.value?.points
  if (!pts || pts.length < 2)
    return null
  let i = 0
  for (let j = 1; j < pts.length; j++) {
    if (pts[j].tsUtc <= t.value)
      i = j
  }
  const a = pts[Math.max(0, i - 1)]
  const b = pts[i]
  const dtH = (b.tsUtc - a.tsUtc) / 3_600_000
  if (dtH <= 0 || dtH > 0.25)
    return null
  const dM = haversineM(a.lat, a.lng, b.lat, b.lng)
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
        <!-- Переключатель режима: Маршрут / Точки Безье -->
        <div class="view-mode-tabs">
          <button
            class="mode-tab-btn"
            :class="{ 'is-active': viewMode === 'route' }"
            title="Отображать сегменты маршрута с классификацией"
            @click="viewMode = 'route'"
          >
            <Icon icon="mdi:map-marker-path" class="tab-icon" />
            <span class="tab-label">Маршрут</span>
          </button>
          <button
            class="mode-tab-btn"
            :class="{ 'is-active': viewMode === 'points' }"
            title="Отображать все точки активности, соединенные кривой Безье"
            @click="viewMode = 'points'"
          >
            <Icon icon="mdi:vector-bezier" class="tab-icon" />
            <span class="tab-label">Точки (Безье)</span>
            <span v-if="totalPointsCount > 0" class="points-pill">{{ totalPointsCount }}</span>
          </button>
        </div>

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
          :disabled="renderSegments.length === 0 && totalPointsCount === 0"
          @click="fitTrackBounds"
        >
          <template #prepend>
            <Icon icon="mdi:crosshairs-gps" />
          </template>
          Трек
        </KitBtn>

        <slot name="top-actions" />

        <KitBtn
          variant="tonal"
          size="sm"
          class="nav-btn close-btn"
          title="Закрыть"
          aria-label="Закрыть"
          @click="handleBack"
        >
          <Icon icon="mdi:close" />
        </KitBtn>
      </div>
    </div>

    <!-- Карта OpenLayers -->
    <div ref="mapHost" class="memories-map" />

    <!-- Анимированный маркер воспроизведения на карте -->
    <div ref="playbackMarkerHost" class="playback-beacon" :class="{ 'is-active': currentPoint != null }">
      <div class="beacon-ripple" :style="{ borderColor: currentActivityColor }" />
      <div class="beacon-core" :style="{ backgroundColor: currentActivityColor }">
        <Icon :icon="currentActivityIcon" class="beacon-icon" />
      </div>
      <div v-if="speedKmhFromPoints !== null && speedKmhFromPoints > 0.5" class="beacon-speed-pill">
        {{ speedKmhFromPoints.toFixed(0) }} км/ч
      </div>
    </div>

    <!-- Интерактивный попап точки -->
    <div ref="popupHost" class="memories-popup">
      <div v-if="selectedPoint" class="point-popup-card">
        <div class="popup-head">
          <div class="popup-title-group">
            <span class="popup-index">Точка #{{ selectedPoint.index }} из {{ selectedPoint.total }}</span>
            <span
              class="popup-act-badge"
              :style="{
                backgroundColor: `${ACTIVITY_COLORS[selectedPoint.point.activity]}20`,
                color: ACTIVITY_COLORS[selectedPoint.point.activity],
              }"
            >
              <Icon :icon="ACTIVITY_ICONS[selectedPoint.point.activity]" />
              {{ ACTIVITY_LABELS[selectedPoint.point.activity] }}
            </span>
          </div>

          <div class="popup-actions">
            <!-- Кнопка удаления точки с автоматической нормализацией маршрута -->
            <button
              class="popup-action-btn delete-btn"
              :disabled="isDeletingPoint"
              title="Удалить эту точку и пересчитать маршрут"
              aria-label="Удалить точку"
              @click.stop="handleDeletePoint(selectedPoint.point)"
            >
              <Icon v-if="isDeletingPoint" icon="mdi:loading" class="spin" />
              <Icon v-else icon="mdi:trash-can-outline" />
            </button>

            <!-- Кнопка закрытия попапа -->
            <button class="popup-action-btn close-btn" aria-label="Закрыть" @click.stop="closePointPopup">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </div>

        <div class="popup-grid">
          <div class="popup-item">
            <span class="item-lbl">Время</span>
            <span class="item-val">{{ formatPointTime(selectedPoint.point.tsUtc) }}</span>
          </div>
          <div class="popup-item">
            <span class="item-lbl">Скорость</span>
            <span class="item-val">
              {{ selectedPoint.point.speed !== null ? `${(selectedPoint.point.speed * 3.6).toFixed(1)} км/ч` : 'Покой' }}
            </span>
          </div>
          <div class="popup-item">
            <span class="item-lbl">Точность GPS</span>
            <span class="item-val" :class="{ 'is-warning': (selectedPoint.point.accuracy ?? 0) > 30 }">
              ±{{ Math.round(selectedPoint.point.accuracy ?? 0) }} м
            </span>
          </div>
          <div v-if="selectedPoint.point.altitude != null" class="popup-item">
            <span class="item-lbl">Высота</span>
            <span class="item-val">{{ Math.round(selectedPoint.point.altitude) }} м</span>
          </div>
          <div class="popup-item popup-coords">
            <span class="item-lbl">Координаты</span>
            <div class="coords-row">
              <span class="item-val font-mono">{{ selectedPoint.point.lat.toFixed(5) }}, {{ selectedPoint.point.lng.toFixed(5) }}</span>
              <button
                class="copy-coords-btn"
                :title="isCopied ? 'Скопировано!' : 'Скопировать координаты'"
                @click.stop="copyCoords(selectedPoint.point)"
              >
                <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="getPointStatusBadge(selectedPoint.point)" class="popup-validity-tag" :class="getPointStatusBadge(selectedPoint.point)?.type">
          <Icon :icon="getPointStatusBadge(selectedPoint.point)!.icon" />
          <span>{{ getPointStatusBadge(selectedPoint.point)!.label }}</span>
        </div>
      </div>
    </div>

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
      v-else-if="renderSegments.length === 0 && totalPointsCount === 0"
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
    <div v-if="renderSegments.length > 0 || totalPointsCount > 0" class="memories-panel">
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
          <button
            class="camera-follow-btn"
            :class="{ 'is-active': isFollowCamera }"
            title="Слежение камерой за движением"
            @click="isFollowCamera = !isFollowCamera"
          >
            <Icon :icon="isFollowCamera ? 'mdi:crosshairs-gps' : 'mdi:crosshairs'" />
            <span class="camera-btn-text">{{ isFollowCamera ? 'Слежение' : 'Свободная' }}</span>
          </button>
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
            class="control-btn step-btn"
            aria-label="Назад на 15 секунд"
            title="-15 сек"
            @click="stepSeconds(-15)"
          >
            <Icon icon="mdi:rewind-15" />
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
            class="control-btn step-btn"
            aria-label="Вперед на 15 секунд"
            title="+15 сек"
            @click="stepSeconds(15)"
          >
            <Icon icon="mdi:fast-forward-15" />
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
            v-for="s in [1, 2, 5, 10, 20]"
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

  .playback-beacon {
    position: relative;
    width: 32px;
    height: 32px;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 25;

    .beacon-ripple {
      position: absolute;
      inset: -6px;
      border-radius: var(--r-full);
      border: 2.5px solid var(--fg-accent-color);
      animation: beaconRipple 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
      pointer-events: none;
    }

    .beacon-core {
      width: 28px;
      height: 28px;
      border-radius: var(--r-full);
      background-color: var(--fg-accent-color);
      border: 2px solid #ffffff;
      box-shadow: var(--s-m);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      transition:
        background-color 0.2s ease,
        transform 0.2s ease;

      .beacon-icon {
        font-size: 16px;
      }
    }

    .beacon-speed-pill {
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      background-color: var(--bg-secondary-color);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-primary-color);
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--r-full);
      white-space: nowrap;
      box-shadow: var(--s-s);
    }
  }

  .memories-popup {
    position: relative;
    pointer-events: auto;
    z-index: 30;

    .point-popup-card {
      position: relative;
      background-color: var(--bg-secondary-color);
      backdrop-filter: blur(14px);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-m);
      padding: 10px 14px;
      min-width: 230px;
      max-width: 290px;
      box-shadow: var(--s-l);
      color: var(--fg-primary-color);
      display: flex;
      flex-direction: column;
      gap: 8px;
      transform: translate(-50%, -100%);
      margin-top: -14px;

      &::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 6px 6px 0 6px;
        border-style: solid;
        border-color: var(--bg-secondary-color) transparent transparent transparent;
      }

      .popup-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .popup-title-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .popup-index {
            font-size: 0.76rem;
            font-weight: 600;
            color: var(--fg-secondary-color);
          }

          .popup-act-badge {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 0.72rem;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 10px;
          }
        }

        .popup-actions {
          display: flex;
          align-items: center;
          gap: 4px;

          .popup-action-btn {
            width: 24px;
            height: 24px;
            border-radius: var(--r-full);
            border: none;
            background: transparent;
            color: var(--fg-secondary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
            font-size: 0.95rem;
            transition: all 0.2s;

            &:hover:not(:disabled) {
              color: var(--fg-primary-color);
              background: var(--bg-hover-color);
            }

            &.delete-btn {
              &:hover:not(:disabled) {
                color: var(--fg-error-color);
                background: rgba(239, 68, 68, 0.15);
              }
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          }
        }
      }

      .popup-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        font-size: 0.78rem;

        .popup-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .item-lbl {
            font-size: 0.68rem;
            color: var(--fg-secondary-color);
          }

          .item-val {
            font-weight: 500;
            color: var(--fg-primary-color);

            &.is-warning {
              color: var(--fg-warning-color);
            }
          }

          &.popup-coords {
            grid-column: 1 / -1;

            .coords-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 6px;

              .font-mono {
                font-family: monospace;
                font-size: 0.74rem;
              }

              .copy-coords-btn {
                background: transparent;
                border: none;
                color: var(--fg-secondary-color);
                cursor: pointer;
                padding: 2px;
                display: flex;
                align-items: center;
                border-radius: var(--r-xs);
                font-size: 0.85rem;
                transition: color 0.2s;

                &:hover {
                  color: var(--fg-primary-color);
                }
              }
            }
          }
        }
      }

      .popup-validity-tag {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.7rem;
        font-weight: 500;
        padding: 3px 7px;
        border-radius: var(--r-xs);
        margin-top: 2px;
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);

        &.flight {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        &.warning {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        &.valid {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }
      }
    }
  }
}

@keyframes beaconRipple {
  0% {
    transform: scale(0.6);
    opacity: 0.95;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
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
    padding: 4px;
    box-shadow: var(--s-m);
    height: 38px;

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
      transition: background-color 0.2s;

      &:hover:not(:disabled) {
        background: var(--bg-hover-color);
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
        color: var(--fg-accent-color);
      }

      .day-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        text-transform: capitalize;
      }

      .today-chip {
        padding: 1px 6px;
        border-radius: var(--r-full);
        font-size: 0.68rem;
        font-weight: 600;
        background: var(--bg-success-color);
        color: var(--fg-success-color);
      }
    }
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    .view-mode-tabs {
      display: inline-flex;
      align-items: center;
      background-color: var(--bg-secondary-color);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-full);
      padding: 3px;
      box-shadow: var(--s-m);
      height: 38px;

      .mode-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--r-full);
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        height: 100%;

        .tab-icon {
          font-size: 1rem;
        }

        .points-pill {
          padding: 0 5px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
          font-size: 0.68rem;
          font-weight: 700;
        }

        &:hover:not(.is-active) {
          color: var(--fg-primary-color);
          background: var(--bg-hover-color);
        }

        &.is-active {
          background: var(--fg-accent-color);
          color: var(--fg-inverted-color);
          box-shadow: var(--s-xs);

          .points-pill {
            background: rgba(var(--fg-inverted-color-rgb, 255, 255, 255), 0.25);
            color: var(--fg-inverted-color);
          }
        }
      }
    }
  }
}

@media (max-width: 640px) {
  .top-nav-bar {
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;

    .day-picker-group {
      width: 100%;
      justify-content: space-between;
      height: 36px;
      padding: 3px 6px;

      .day-current {
        flex: 1;
        justify-content: center;
        min-width: 0;
        gap: 5px;

        .day-text {
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .today-chip {
          display: none;
        }
      }
    }

    .top-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 6px;

      .view-mode-tabs {
        flex: 1;
        height: 36px;
        min-width: 0;

        .mode-tab-btn {
          flex: 1;
          justify-content: center;
          padding: 4px 6px;

          .tab-label {
            display: inline;
            font-size: 0.74rem;
          }

          .points-pill {
            display: none;
          }
        }
      }

      .close-btn {
        flex-shrink: 0;
      }
    }
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
        color: var(--fg-primary-color);
      }

      .time-tz {
        font-size: 0.7rem;
        color: var(--fg-secondary-color);
      }
    }

    .activity-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: var(--r-full);
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid;
    }

    .speed-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.82rem;
      color: var(--fg-secondary-color);
    }

    .track-stats-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.78rem;
      color: var(--fg-secondary-color);

      .camera-follow-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: var(--bg-hover-color);
          color: var(--fg-primary-color);
        }

        &.is-active {
          background: rgba(var(--fg-accent-color-rgb, 59, 130, 246), 0.18);
          border-color: var(--border-accent-color);
          color: var(--fg-accent-color);
          font-weight: 600;
        }

        @media (max-width: 600px) {
          .camera-btn-text {
            display: none;
          }
        }
      }
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
      accent-color: var(--fg-accent-color);
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
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        transition:
          background-color 0.2s,
          transform 0.1s;

        &:hover:not(:disabled) {
          background: var(--bg-hover-color);
        }

        &:active:not(:disabled) {
          transform: scale(0.95);
        }

        &.step-btn {
          font-size: 1.15rem;
        }

        &.play-btn {
          width: 42px;
          height: 42px;
          background: var(--fg-accent-color);
          color: var(--fg-inverted-color);
          border-color: var(--border-accent-color);
          font-size: 1.3rem;

          &:hover:not(:disabled) {
            background: var(--bg-action-hover-color);
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
      background: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 3px;
      border-radius: var(--r-full);

      .speed-chip {
        padding: 2px 8px;
        border-radius: var(--r-full);
        font-size: 0.72rem;
        font-weight: 600;
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        cursor: pointer;
        transition: all 0.2s;

        &.is-active {
          background: var(--bg-hover-color);
          color: var(--fg-primary-color);
        }
      }
    }

    .time-range-display {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;
    }
  }

  @media (max-width: 640px) {
    bottom: 8px;
    left: 8px;
    right: 8px;
    padding: 10px 12px;
    gap: 8px;

    .memories-readout {
      flex-wrap: wrap;
      gap: 6px 10px;

      .readout-time-group {
        .time {
          font-size: 1.1rem;
        }
      }

      .activity-badge {
        padding: 2px 7px;
        font-size: 0.74rem;
      }

      .speed-badge {
        font-size: 0.74rem;
      }

      .track-stats-right {
        gap: 6px;
        font-size: 0.72rem;

        .points-count {
          font-size: 0.7rem;
        }
      }
    }

    .slider-container {
      margin: 2px 0;
    }

    .memories-actions {
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;

      .playback-controls {
        order: 1;
        gap: 6px;

        .control-btn {
          width: 32px;
          height: 32px;
          font-size: 1rem;

          &.play-btn {
            width: 38px;
            height: 38px;
            font-size: 1.2rem;
          }
        }
      }

      .speed-selector {
        order: 2;
        padding: 2px;
        gap: 2px;

        .speed-chip {
          padding: 2px 6px;
          font-size: 0.68rem;
        }
      }

      .time-range-display {
        order: 3;
        width: 100%;
        text-align: center;
        font-size: 0.72rem;
        margin-top: -2px;
      }
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
