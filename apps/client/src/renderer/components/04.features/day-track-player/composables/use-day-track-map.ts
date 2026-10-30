import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, PointStatusBadge, RenderSegment, SelectedPointInfo, TrackPhoto, TrackPhotoCluster, ViewMode } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { haversineM, splitTrackIntoLegs } from '~/shared/services/tracking/track-processing'
import { ACTIVITY_COLORS } from '../models/types'

interface TrackMapBounds {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

function includeTrackCoordinate(bounds: TrackMapBounds, longitude: number, latitude: number) {
  bounds.minLon = Math.min(bounds.minLon, longitude)
  bounds.minLat = Math.min(bounds.minLat, latitude)
  bounds.maxLon = Math.max(bounds.maxLon, longitude)
  bounds.maxLat = Math.max(bounds.maxLat, latitude)
}

function createEmptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function findCoveredPointIndex(points: DayPoint[], timestamp: number): number {
  let low = 0
  let high = points.length - 1
  let coveredIndex = -1

  while (low <= high) {
    const middle = (low + high) >> 1

    if (points[middle].tsUtc <= timestamp) {
      coveredIndex = middle
      low = middle + 1
    }
    else {
      high = middle - 1
    }
  }

  return coveredIndex
}

function createProgressFeatures(points: DayPoint[]): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []

  for (const leg of splitTrackIntoLegs(points)) {
    if (leg.points.length < 2)
      continue

    const lastPoint = leg.points.at(-1)
    const color = ACTIVITY_COLORS[lastPoint?.activity || 'unknown'] || '#2196f3'

    features.push({
      type: 'Feature',
      properties: { color, glowColor: `${color}40` },
      geometry: { type: 'LineString', coordinates: leg.points.map(point => [point.lng, point.lat]) },
    })
  }

  return features
}

export interface UseDayTrackMapOptions {
  mapHost: Ref<HTMLElement | null>
  popupHost: Ref<HTMLElement | null>
  photoPopupHost?: Ref<HTMLElement | null>
  playbackMarkerHost: Ref<HTMLElement | null>
  dayData: Ref<DayData | null>
  displayPoints: ComputedRef<DayPoint[]>
  renderSegments: ComputedRef<RenderSegment[]>
  currentPoint: ComputedRef<DayPoint | null>
  currentActivityColor: ComputedRef<string>
  t: Ref<number>
  isPlaying: Ref<boolean>
  isFollowCamera: Ref<boolean>
  viewMode: Ref<ViewMode>
  locatedPhotos?: ComputedRef<TrackPhoto[]>
  isPhotosVisible?: Ref<boolean>
  onSelectPhoto?: (photo: TrackPhoto | null) => void
  onSelectCluster?: (photos: TrackPhoto[]) => void
}

export function useDayTrackMap(options: UseDayTrackMapOptions) {
  const {
    mapHost,
    popupHost,
    photoPopupHost,
    playbackMarkerHost,
    dayData,
    displayPoints,
    renderSegments,
    currentPoint,
    currentActivityColor: _currentActivityColor,
    t,
    isPlaying,
    isFollowCamera,
    viewMode,
    locatedPhotos,
    isPhotosVisible,
    onSelectPhoto,
    onSelectCluster,
  } = options

  const { mapInstance, isMapReady, initMap } = useKitMap()
  const mapCenter: [number, number] = [37.6176, 55.7558]

  let playbackMarker: maplibregl.Marker | null = null
  let pointPopup: maplibregl.Popup | null = null
  let photoPopup: maplibregl.Popup | null = null
  let activePhotoMarkers: Array<{
    marker: maplibregl.Marker
    element: HTMLElement
    photos: TrackPhoto[]
  }> = []
  // Подпись текущей раскладки кластеров. Пока состав кластеров не меняется,
  // DOM-маркеры не пересоздаются: раньше это происходило на каждом движении карты.
  let photoMarkersSignature = ''
  // Радиус группировки — в метрах, а не в пикселях экрана: раскладка не должна
  // зависеть от зума, иначе метки переезжают прямо во время масштабирования.
  const CLUSTER_RADIUS_M = 50

  function closePhotoPopup() {
    if (photoPopup?.isOpen()) {
      photoPopup.remove()
    }
  }

  const selectedPoint = ref<SelectedPointInfo | null>(null)

  const isCopied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // Последний отрисованный набор точек — нужен обработчику клика
  // (в «Маршруте» слой точек отфильтрован, поэтому ищем ближайшую точку вручную).
  let renderedPoints: DayPoint[] = []

  function selectPointByIndex(index: number) {
    if (index < 1 || index > renderedPoints.length)
      return

    const p = renderedPoints[index - 1]

    if (!p)
      return

    selectedPoint.value = {
      point: p,
      index,
      total: renderedPoints.length,
    }

    if (pointPopup && mapInstance.value) {
      pointPopup.setLngLat([p.lng, p.lat]).addTo(mapInstance.value)
    }
  }

  const ROUTE_SOURCE_ID = 'day-track-route-source'
  const PROGRESS_SOURCE_ID = 'day-track-progress-source'
  const POINTS_SOURCE_ID = 'day-track-points-source'
  const PHOTO_ROUTE_SOURCE_ID = 'day-track-photo-route-source'

  const ROUTE_LAYER_ID = 'day-track-route-layer'
  const ROUTE_CASING_LAYER_ID = 'day-track-route-casing-layer'
  const PROGRESS_GLOW_LAYER_ID = 'day-track-progress-glow-layer'
  const PROGRESS_LINE_LAYER_ID = 'day-track-progress-line-layer'
  const POINTS_LAYER_ID = 'day-track-points-layer'
  const PHOTO_ROUTE_LAYER_ID = 'day-track-photo-route-layer'

  function copyCoords(p: DayPoint) {
    const txt = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt)
      isCopied.value = true

      if (typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(15)
        }
        catch {}
      }

      if (copyTimer)
        clearTimeout(copyTimer)

      copyTimer = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    }
  }

  function getPointStatusBadge(p: DayPoint): PointStatusBadge {
    const speed = (p.speed ?? 0) * 3.6

    if (speed > 350) {
      return { type: 'flight', icon: 'mdi:airplane', label: 'Авиаперелет / Скоростное перемещение' }
    }

    if (p.stop)
      return { type: 'valid', icon: 'mdi:pause-circle-outline', label: `Остановка · ${Math.round((p.stop.endedAt - p.stop.startedAt) / 60_000)} мин · ${p.stop.samplesCount} измерений` }

    if (p.accuracy == null || p.accuracy > 60) {
      return { type: 'warning', icon: 'mdi:alert-outline', label: 'Низкая точность спутника' }
    }

    return { type: 'valid', icon: 'mdi:check-circle-outline', label: 'Валидная GPS-точка' }
  }

  function closePointPopup() {
    selectedPoint.value = null

    if (pointPopup?.isOpen()) {
      pointPopup.remove()
    }
  }

  function fitTrackBounds() {
    const pts = dayData.value?.points || []
    // Скрытый слой фото в расчёт не берём: прятать фото и одновременно вписывать по ним — странно
    const photos = isPhotosVisible?.value === false ? [] : (locatedPhotos?.value || [])

    const bounds: TrackMapBounds = {
      minLon: Number.POSITIVE_INFINITY,
      minLat: Number.POSITIVE_INFINITY,
      maxLon: Number.NEGATIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
    }

    pts.forEach(point => includeTrackCoordinate(bounds, point.lng, point.lat))

    // День без GPS-трека (или снимки в стороне от него) — единственные ориентиры фото
    photos.forEach(photo => includeTrackCoordinate(bounds, photo.lng, photo.lat))

    if (bounds.minLon === Number.POSITIVE_INFINITY)
      return

    mapInstance.value?.fitBounds([
      [bounds.minLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat],
    ], {
      padding: { top: 60, right: 60, bottom: 140, left: 60 },
      maxZoom: 16,
      duration: 600,
    })
  }

  const PROGRESS_THROTTLE_MS = 50 // Строгий лимит 20 FPS (интервал 50 мс) для предотвращения спама в Web Worker
  let progressTimer: ReturnType<typeof setTimeout> | null = null
  let lastProgressUpdateTs = 0

  function scheduleProgressUpdate(force = false) {
    if (force) {
      if (progressTimer) {
        clearTimeout(progressTimer)
        progressTimer = null
      }

      lastProgressUpdateTs = performance.now()
      updateProgressLine()

      return
    }

    const now = performance.now()
    const elapsed = now - lastProgressUpdateTs

    if (elapsed >= PROGRESS_THROTTLE_MS) {
      if (progressTimer) {
        clearTimeout(progressTimer)
        progressTimer = null
      }

      lastProgressUpdateTs = now
      updateProgressLine()
    }
    else if (!progressTimer) {
      progressTimer = setTimeout(() => {
        progressTimer = null
        lastProgressUpdateTs = performance.now()
        updateProgressLine()
      }, PROGRESS_THROTTLE_MS - elapsed)
    }
  }

  function updateProgressLine() {
    const map = mapInstance.value

    if (!map || !map.getSource(PROGRESS_SOURCE_ID))
      return

    const points = dayData.value?.points

    if (t.value === 0 || !points?.length) {
      setProgressGeojson(map, createEmptyFeatureCollection())

      return
    }

    // Быстрый бинарный поиск границы пройденных точек без лишней фильтрации и сортировки
    const coveredIndex = findCoveredPointIndex(points, t.value)

    if (coveredIndex < 1) {
      setProgressGeojson(map, createEmptyFeatureCollection())

      return
    }

    const coveredPoints = points.slice(0, coveredIndex + 1)
    setProgressGeojson(map, { type: 'FeatureCollection', features: createProgressFeatures(coveredPoints) })
  }

  function setProgressGeojson(map: maplibregl.Map, data: GeoJSON.FeatureCollection) {
    ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(data)
  }

  function ensureLayers() {
    const map = mapInstance.value

    if (!map)
      return

    ensureRouteAndProgressLayers(map)
    ensurePointAndPhotoLayers(map)
  }

  function ensureRouteAndProgressLayers(map: maplibregl.Map) {
    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(ROUTE_LAYER_ID)) {
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': 0.95,
        },
      })
    }

    // Подложка-кант под линией маршрута: отделяет цвет трека от подложки карты,
    // чтобы маршрут читался линией, а не набором цветных пятен.
    // Параметры сохранены в исходном эталонном виде: line-blur 1.5, width + 5, opacity 0.35.
    if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.addLayer({
        id: ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0f172a',
          'line-opacity': 0.35,
          'line-width': ['+', ['get', 'width'], 5],
          'line-blur': 1.5,
        },
      }, ROUTE_LAYER_ID)
    }

    if (!map.getSource(PROGRESS_SOURCE_ID)) {
      map.addSource(PROGRESS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(PROGRESS_GLOW_LAYER_ID)) {
      map.addLayer({
        id: PROGRESS_GLOW_LAYER_ID,
        type: 'line',
        source: PROGRESS_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'glowColor'],
          'line-width': 8,
          'line-opacity': 0.8,
        },
      })
    }

    if (!map.getLayer(PROGRESS_LINE_LAYER_ID)) {
      map.addLayer({
        id: PROGRESS_LINE_LAYER_ID,
        type: 'line',
        source: PROGRESS_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
        },
      })
    }
  }

  function ensurePointAndPhotoLayers(map: maplibregl.Map) {
    if (!map.getSource(POINTS_SOURCE_ID)) {
      map.addSource(POINTS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(POINTS_LAYER_ID)) {
      map.addLayer({
        id: POINTS_LAYER_ID,
        type: 'circle',
        source: POINTS_SOURCE_ID,
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['get', 'strokeWidth'],
        },
      })
    }

    if (!map.getSource(PHOTO_ROUTE_SOURCE_ID)) {
      map.addSource(PHOTO_ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(PHOTO_ROUTE_LAYER_ID)) {
      map.addLayer({
        id: PHOTO_ROUTE_LAYER_ID,
        type: 'line',
        source: PHOTO_ROUTE_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2.5,
          'line-dasharray': [2, 3],
          'line-opacity': 0.75,
        },
      })
    }
  }

  function getUniqueTrackPoints(points: DayPoint[]): DayPoint[] {
    return points.filter((point, index) => {
      const previous = points[index - 1]

      return !previous || Math.abs(previous.lat - point.lat) > 1e-6 || Math.abs(previous.lng - point.lng) > 1e-6
    })
  }

  function getRouteFeatures(uniquePoints: DayPoint[]): GeoJSON.Feature[] {
    if (viewMode.value === 'route')
      return createSegmentRouteFeatures()

    if (viewMode.value === 'points')
      return createPointModeRouteFeatures(uniquePoints)

    return []
  }

  function createSegmentRouteFeatures(): GeoJSON.Feature[] {
    const features: GeoJSON.Feature[] = []

    for (const segment of renderSegments.value) {
      if (segment.activity === 'still')
        continue

      const coordinates = segment.geometry || segment.points.map(point => [point.lng, point.lat])

      if (coordinates.length < 2)
        continue

      features.push({
        type: 'Feature',
        properties: {
          color: ACTIVITY_COLORS[segment.activity] || ACTIVITY_COLORS.unknown,
          width: segment.activity === 'rail' ? 6 : 4.5,
        },
        geometry: { type: 'LineString', coordinates },
      })
    }

    return features
  }

  function createPointModeRouteFeatures(points: DayPoint[]): GeoJSON.Feature[] {
    return splitTrackIntoLegs(points)
      .filter(leg => leg.points.length >= 2)
      .map(leg => ({
        type: 'Feature' as const,
        properties: { color: 'rgba(59, 130, 246, 0.45)', width: 3 },
        geometry: { type: 'LineString' as const, coordinates: leg.points.map(point => [point.lng, point.lat]) },
      }))
  }

  function getWaypointRefs(points: DayPoint[]): Set<DayPoint> {
    const waypoints = new Set<DayPoint>()

    for (const leg of splitTrackIntoLegs(points)) {
      waypoints.add(leg.points[0])
      waypoints.add(leg.points[leg.points.length - 1])
    }

    let lastKept: DayPoint | null = null

    for (const point of points) {
      if (!waypoints.has(point) && !point.stop)
        continue

      if (isNearPreviousWaypoint(point, lastKept))
        continue

      waypoints.add(point)
      lastKept = point
    }

    return waypoints
  }

  function isNearPreviousWaypoint(point: DayPoint, previous: DayPoint | null): boolean {
    if (!previous)
      return false

    const distance = haversineM(
      previous.lat,
      previous.lng,
      point.lat,
      point.lng,
    )

    return distance < 15 && point.tsUtc - previous.tsUtc < 30_000
  }

  function createTrackPointFeatures(points: DayPoint[], isPointsMode: boolean): GeoJSON.Feature[] {
    const waypoints = isPointsMode ? new Set<DayPoint>() : getWaypointRefs(points)

    return points.flatMap((point, index) => {
      const isWaypoint = isPointsMode || waypoints.has(point)

      return isWaypoint
        ? [createTrackPointFeature(
            point,
            index,
            points.length,
            isPointsMode,
          )]
        : []
    })
  }

  function createTrackPointFeature(
    point: DayPoint,
    index: number,
    total: number,
    isPointsMode: boolean,
  ): GeoJSON.Feature {
    return {
      type: 'Feature',
      properties: {
        pointIndex: index + 1,
        totalPoints: total,
        stopLabel: getStopLabel(point),
        kind: 'waypoint',
        color: ACTIVITY_COLORS[point.activity] || '#2196f3',
        radius: point.stop ? 9 : isPointsMode ? 4 : 5,
        strokeWidth: isPointsMode ? 1.5 : (point.stop ? 2 : 1.5),
      },
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
    }
  }

  function getStopLabel(point: DayPoint): string {
    return point.stop ? `Пауза ${Math.round((point.stop.endedAt - point.stop.startedAt) / 60_000)} мин` : ''
  }

  function updateStopAreaLayer(map: maplibregl.Map, points: DayPoint[], isPointsMode: boolean) {
    ensureStopLabelLayer(map)
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: createStopAreaFeatures(points, isPointsMode) }
    const source = map.getSource('day-track-stop-areas') as maplibregl.GeoJSONSource | undefined

    if (source)
      source.setData(data)
    else
      map.addSource('day-track-stop-areas', { type: 'geojson', data })

    ensureStopAreaFillLayer(map)
  }

  function ensureStopLabelLayer(map: maplibregl.Map) {
    if (map.getLayer('day-track-stop-labels'))
      return

    map.addLayer({
      id: 'day-track-stop-labels',
      type: 'symbol',
      source: POINTS_SOURCE_ID,
      filter: ['!=', ['get', 'stopLabel'], ''],
      layout: { 'text-field': ['get', 'stopLabel'], 'text-size': 12, 'text-offset': [0, 1.6], 'text-anchor': 'top' },
      paint: { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    })
  }

  function createStopAreaFeatures(points: DayPoint[], isPointsMode: boolean): GeoJSON.Feature[] {
    if (isPointsMode)
      return []

    const seenStopTimes = new Set<number>()
    const features: GeoJSON.Feature[] = []

    for (const point of points) {
      if (!point.stop || seenStopTimes.has(point.stop.startedAt))
        continue

      seenStopTimes.add(point.stop.startedAt)
      features.push(createStopAreaFeature(point))
    }

    return features
  }

  function createStopAreaFeature(point: DayPoint): GeoJSON.Feature {
    const radius = point.stop!.radiusM
    const ring = Array.from({ length: 49 }, (_, index) => {
      const angle = index * Math.PI * 2 / 48

      return [
        point.lng + Math.cos(angle) * radius / (111_320 * Math.max(0.01, Math.cos(point.lat * Math.PI / 180))),
        point.lat + Math.sin(angle) * radius / 111_320,
      ]
    })

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
  }

  function ensureStopAreaFillLayer(map: maplibregl.Map) {
    if (map.getLayer('day-track-stop-areas'))
      return

    map.addLayer({
      id: 'day-track-stop-areas',
      type: 'fill',
      source: 'day-track-stop-areas',
      paint: { 'fill-color': '#64748b', 'fill-opacity': 0.13, 'fill-outline-color': '#64748b' },
    }, POINTS_LAYER_ID)
  }

  function createPhotoMarkerElement(cluster: TrackPhotoCluster, onPhotoClick: (p: TrackPhoto) => void, onClusterClick: (photos: TrackPhoto[]) => void): HTMLElement {
    // Корень маркера — служебная оболочка: позицию и transform ему задаёт MapLibre
    // (transform: translate(-50%,-50%) translate(x,y)). Всё визуальное живёт в
    // .photo-marker-body, иначе собственные transform/position на корне ломают
    // привязку метки к координате.
    const el = document.createElement('div')
    el.className = 'day-track-photo-marker'

    const body = document.createElement('div')
    body.className = 'photo-marker-body'
    el.appendChild(body)

    const img = document.createElement('img')
    img.src = cluster.representativePhoto.thumbnailUrl
    img.alt = cluster.representativePhoto.title || 'Фото'
    img.className = 'photo-marker-img'
    img.loading = 'lazy'
    body.appendChild(img)

    if (cluster.count > 1) {
      const badge = document.createElement('span')
      badge.className = 'photo-marker-badge'
      badge.textContent = String(cluster.count)
      body.appendChild(badge)
      el.title = `${cluster.count} фото в этой точке`
    }
    else {
      const photo = cluster.representativePhoto
      el.title = photo.title || photo.comment || 'Фото'

      if (photo.source === 'gps') {
        const icon = document.createElement('span')
        icon.className = 'photo-marker-source-icon source-gps'
        icon.title = 'GPS из фото'
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9"><circle cx="12" cy="12" r="6" fill="#16a34a"/><circle cx="12" cy="12" r="10" fill="none" stroke="#16a34a" stroke-width="2.5"/></svg>`
        body.appendChild(icon)
      }
      else if (photo.source === 'interpolated') {
        const icon = document.createElement('span')
        icon.className = 'photo-marker-source-icon source-interpolated'
        icon.title = 'Привязано по треку'
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9"><path fill="#2563eb" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h-4V7h2v4h2z"/></svg>`
        body.appendChild(icon)
      }
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation()

      if (cluster.count > 1) {
        onClusterClick(cluster.photos)
      }
      else {
        onPhotoClick(cluster.representativePhoto)
      }
    })

    return el
  }

  function clearPhotoMarkers() {
    for (const item of activePhotoMarkers) {
      item.marker.remove()
    }

    activePhotoMarkers = []
  }

  /**
   * Группировка снимков по географии: фото в пределах CLUSTER_RADIUS_M метров
   * сливаются в один «шарик» со счётчиком. Раскладка считается один раз на
   * набор снимков и не зависит от зума — метка приклеена к месту и при
   * масштабировании просто едет вместе с картой.
   *
   * Якорь группы — координаты её первой (самой ранней) фотографии, а не
   * центроид: метка стоит на реальной точке съёмки, а не в пустоте между кадрами.
   */
  function buildPhotoClusters(photos: TrackPhoto[]): TrackPhotoCluster[] {
    const clusters: TrackPhotoCluster[] = []
    const visited = new Uint8Array(photos.length)

    for (let i = 0; i < photos.length; i++) {
      if (visited[i])
        continue

      visited[i] = 1
      const seed = photos[i]
      const clusterPhotos: TrackPhoto[] = [seed]

      for (let j = i + 1; j < photos.length; j++) {
        if (visited[j])
          continue

        if (haversineM(
          seed.lat,
          seed.lng,
          photos[j].lat,
          photos[j].lng,
        ) <= CLUSTER_RADIUS_M) {
          visited[j] = 1
          clusterPhotos.push(photos[j])
        }
      }

      clusters.push({
        id: `cluster-${seed.id}`,
        lat: seed.lat,
        lng: seed.lng,
        photos: clusterPhotos,
        count: clusterPhotos.length,
        representativePhoto: seed,
      })
    }

    return clusters
  }

  function updatePhotoMarkersPlaybackState() {
    if (activePhotoMarkers.length === 0)
      return

    const curT = t.value

    for (const item of activePhotoMarkers) {
      const isNear = curT > 0 && item.photos.some(p => Math.abs(curT - p.tsUtc) < 45_000)
      item.element.classList.toggle('is-playback-active', isNear)
    }
  }

  /**
   * Пересобирает слой фотографий. Вызывается только когда меняется набор снимков
   * (или видимость слоя) — при панорамировании и зуме слой не трогаем: координаты
   * групп фиксированы, MapLibre сам держит маркеры приклеенными к местам.
   */
  function updatePhotoLayer() {
    const map = mapInstance.value

    if (!map || !isMapReady.value)
      return

    const photos = locatedPhotos?.value || []

    if (!isPhotosVisible?.value || photos.length === 0) {
      photoMarkersSignature = ''
      clearPhotoMarkers()

      return
    }

    const clusters = buildPhotoClusters(photos)
    const signature = clusters.map(c => `${c.id}(${c.photos.map(p => p.id).join(',')})`).join('|')

    if (signature === photoMarkersSignature) {
      updatePhotoMarkersPlaybackState()

      return
    }

    photoMarkersSignature = signature

    // 3. Пересоздаём маркеры на карте
    clearPhotoMarkers()

    for (const cluster of clusters) {
      const el = createPhotoMarkerElement(cluster, (photo) => {
        closePointPopup()
        onSelectPhoto?.(photo)

        if (photoPopup && mapInstance.value) {
          photoPopup.setLngLat([photo.lng, photo.lat]).addTo(mapInstance.value)
        }
      }, (clusterPhotos) => {
        if (map.getZoom() < 17 && clusterPhotos.length > 1) {
          const bounds = new maplibregl.LngLatBounds()

          for (const p of clusterPhotos) {
            bounds.extend([p.lng, p.lat])
          }

          map.fitBounds(bounds, {
            padding: { top: 70, right: 70, bottom: 120, left: 70 },
            maxZoom: 17.5,
            duration: 400,
          })
        }
        else {
          closePointPopup()
          onSelectCluster?.(clusterPhotos)
          const first = clusterPhotos[0]

          if (photoPopup && first && mapInstance.value) {
            photoPopup.setLngLat([first.lng, first.lat]).addTo(mapInstance.value)
          }
        }
      })

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(map)

      activePhotoMarkers.push({
        marker,
        element: el,
        photos: cluster.photos,
      })
    }

    updatePhotoMarkersPlaybackState()
  }

  function rebuildFeatures() {
    const map = mapInstance.value

    if (!map || !isMapReady.value)
      return

    prepareMapForRebuild()
    const points = getPointsForRebuild()

    updateRouteLayer(map, getUniqueTrackPoints(points.rawPoints))
    renderedPoints = points.pointsList
    updatePointLayer(map, points.pointsList, points.isPointsMode)
    updateStopAreaLayer(map, points.pointsList, points.isPointsMode)
    updatePhotoLayers(map, points.allPoints)
  }

  function prepareMapForRebuild() {
    ensureLayers()
    closePointPopup()
    // Попап фото привязан к координате прошлого дня/режима — при пересборке слоёв
    // он остался бы висеть над пустым местом.
    closePhotoPopup()
    onSelectPhoto?.(null)
  }

  function getPointsForRebuild() {
    const allPoints = dayData.value?.points || []
    const rawPoints = dayData.value?.rawPoints ?? displayPoints.value
    const isPointsMode = viewMode.value === 'points'
    const pointsList = isPointsMode ? rawPoints : displayPoints.value

    return { allPoints, rawPoints, isPointsMode, pointsList }
  }

  function updateRouteLayer(map: maplibregl.Map, points: DayPoint[]) {
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: getRouteFeatures(points) }
    ;(map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(data)
  }

  function updatePointLayer(map: maplibregl.Map, points: DayPoint[], isPointsMode: boolean) {
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: createTrackPointFeatures(points, isPointsMode) }
    ;(map.getSource(POINTS_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(data)

    if (map.getLayer(POINTS_LAYER_ID))
      map.setFilter(POINTS_LAYER_ID, isPointsMode ? null : ['==', ['get', 'kind'], 'waypoint'])
  }

  function getVisiblePhotos(): TrackPhoto[] {
    return isPhotosVisible?.value && locatedPhotos?.value ? locatedPhotos.value : []
  }

  function updatePhotoLayers(map: maplibregl.Map, rawPoints: DayPoint[]) {
    const photos = getVisiblePhotos()
    ;(map.getSource(PHOTO_ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(createEmptyFeatureCollection())
    scheduleProgressUpdate(true)
    updatePhotoLayer()

    if (hasTrackMapData(rawPoints, photos))
      fitTrackBounds()
  }

  function hasTrackMapData(rawPoints: DayPoint[], photos: TrackPhoto[]): boolean {
    return renderSegments.value.length > 0 || rawPoints.length > 0 || photos.length > 0
  }

  function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  function getPointSelectionFromMap(map: maplibregl.Map, event: maplibregl.MapMouseEvent, isTouch: boolean): SelectedPointInfo | null {
    return findPointFeatureSelection(map, event, isTouch) || findNearestTrackPoint(map, event, isTouch)
  }

  function findPointFeatureSelection(map: maplibregl.Map, event: maplibregl.MapMouseEvent, isTouch: boolean): SelectedPointInfo | null {
    const padding = isTouch ? 24 : 10
    const bounds: [maplibregl.PointLike, maplibregl.PointLike] = [
      [event.point.x - padding, event.point.y - padding],
      [event.point.x + padding, event.point.y + padding],
    ]
    const features = map.queryRenderedFeatures(bounds, { layers: [POINTS_LAYER_ID] })

    if (!features.length)
      return null

    const closest = findClosestPointFeature(map, features, event.point)
    const index = Number(closest.properties?.pointIndex)
    const point = renderedPoints[index - 1]

    return point ? { point, index, total: renderedPoints.length || 1 } : null
  }

  function findClosestPointFeature(map: maplibregl.Map, features: maplibregl.MapGeoJSONFeature[], target: maplibregl.Point): maplibregl.MapGeoJSONFeature {
    let closest = features[0]
    let closestDistance = Number.POSITIVE_INFINITY

    for (const feature of features) {
      if (feature.geometry.type !== 'Point')
        continue

      const coordinates = feature.geometry.coordinates as [number, number]
      const screenPoint = map.project(coordinates)
      const distance = (screenPoint.x - target.x) ** 2 + (screenPoint.y - target.y) ** 2

      if (distance < closestDistance) {
        closestDistance = distance
        closest = feature
      }
    }

    return closest
  }

  function findNearestTrackPoint(map: maplibregl.Map, event: maplibregl.MapMouseEvent, isTouch: boolean): SelectedPointInfo | null {
    if (!renderedPoints.length)
      return null

    const clicked = map.unproject(event.point)
    const metersPerPixel = 156_543.03392 * Math.cos((clicked.lat * Math.PI) / 180) / 2 ** map.getZoom()
    const maxDistance = Math.max(isTouch ? 80 : 50, metersPerPixel * (isTouch ? 28 : 16))
    const selected = findNearestPointByCoordinates(clicked.lat, clicked.lng, maxDistance)

    return selected && selected.distance <= maxDistance
      ? { point: selected.point, index: selected.index, total: renderedPoints.length || 1 }
      : null
  }

  function findNearestPointByCoordinates(latitude: number, longitude: number, maxDistance: number): { point: DayPoint, index: number, distance: number } | null {
    const maxDeltaLat = maxDistance / 111_000
    const maxDeltaLng = maxDistance / (111_000 * Math.max(0.1, Math.cos((latitude * Math.PI) / 180)))
    let nearest: { point: DayPoint, index: number, distance: number } | null = null

    renderedPoints.forEach((candidate, index) => {
      if (isOutsidePointHitbox(
        candidate,
        latitude,
        longitude,
        maxDeltaLat,
        maxDeltaLng,
      )) {
        return
      }

      const distance = haversineM(
        latitude,
        longitude,
        candidate.lat,
        candidate.lng,
      )

      if (!nearest || distance < nearest.distance)
        nearest = { point: candidate, index: index + 1, distance }
    })

    return nearest
  }

  function isOutsidePointHitbox(
    point: DayPoint,
    latitude: number,
    longitude: number,
    maxDeltaLat: number,
    maxDeltaLng: number,
  ): boolean {
    return Math.abs(point.lat - latitude) > maxDeltaLat || Math.abs(point.lng - longitude) > maxDeltaLng
  }

  function handleMapClick(map: maplibregl.Map, event: maplibregl.MapMouseEvent) {
    closePhotoPopup()
    onSelectPhoto?.(null)

    const selection = getPointSelectionFromMap(map, event, isTouchDevice())

    if (!selection) {
      closePointPopup()

      return
    }

    selectedPoint.value = selection
    pointPopup?.setLngLat([selection.point.lng, selection.point.lat]).addTo(map)
  }

  onMounted(async () => {
    if (!mapHost.value)
      return

    await initMap(mapHost.value, null, { center: mapCenter, zoom: 11 })
    const map = mapInstance.value

    if (!map)
      return

    ensureLayers()

    map.on('style.load', () => {
      ensureLayers()
      rebuildFeatures()

      if (playbackMarker)
        playbackMarker.addTo(map)
    })

    if (playbackMarkerHost.value) {
      playbackMarker = new maplibregl.Marker({
        element: playbackMarkerHost.value,
        anchor: 'center',
      })
        .setLngLat(mapCenter)
        .addTo(map)
    }

    if (popupHost.value) {
      pointPopup = new maplibregl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        className: 'day-track-point-popup',
      }).setDOMContent(popupHost.value)
    }

    if (photoPopupHost?.value) {
      photoPopup = new maplibregl.Popup({
        // Шарик метки 38 px: поднимаем попап выше его верхней кромки, иначе
        // «хвостик» попапа ложится поверх картинки.
        offset: 26,
        closeButton: false,
        closeOnClick: false,
        className: 'day-track-photo-popup',
      }).setDOMContent(photoPopupHost.value)
    }

    // Раскладку фото по зуму НЕ пересобираем: группы считаются по географии,
    // поэтому подпись кластеров от зума не зависит, и метки просто едут с картой.
    // (Раньше пересборка на move/zoom была и причиной прыжков, и причиной лагов.)

    // Клик по карте использует расширенный хитбокс на мобильных устройствах.
    map.on('click', event => handleMapClick(map, event))

    map.on('mouseenter', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })

    watch(isMapReady, (ready) => {
      if (ready)
        rebuildFeatures()
    }, { immediate: true })
  })

  watch(currentPoint, (p) => {
    if (p && mapInstance.value) {
      if (playbackMarker) {
        playbackMarker.setLngLat([p.lng, p.lat])
      }

      if (isFollowCamera.value) {
        if (isPlaying.value) {
          mapInstance.value.jumpTo({
            center: [p.lng, p.lat],
          })
        }
        else {
          mapInstance.value.easeTo({
            center: [p.lng, p.lat],
            duration: 150,
          })
        }
      }
    }
  })

  watch(t, (curT) => {
    scheduleProgressUpdate(!isPlaying.value)

    if (curT > 0)
      updatePhotoMarkersPlaybackState()
  })

  watch([renderSegments, viewMode], () => rebuildFeatures())

  if (locatedPhotos && isPhotosVisible) {
    // Глубокое отслеживание не нужно: computed всегда отдаёт новую ссылку,
    // а deep-обход 60 снимков дёргал полную пересборку слоёв на каждое изменение.
    watch(locatedPhotos, () => {
      updatePhotoLayer()

      // День без GPS-трека: камера держится только на фото, вписываем по ним.
      // Когда трек есть, повторный fit не делаем — иначе камера дёргается
      // на каждое добавленное воспоминание.
      if (isPhotosVisible.value && !dayData.value?.points?.length)
        fitTrackBounds()
    })
    watch(isPhotosVisible, () => updatePhotoLayer())
  }

  onBeforeUnmount(() => {
    if (copyTimer)
      clearTimeout(copyTimer)

    if (progressTimer) {
      clearTimeout(progressTimer)
      progressTimer = null
    }

    clearPhotoMarkers()

    if (playbackMarker) {
      playbackMarker.remove()
      playbackMarker = null
    }

    if (pointPopup) {
      pointPopup.remove()
      pointPopup = null
    }

    if (photoPopup) {
      photoPopup.remove()
      photoPopup = null
    }
  })

  return {
    selectedPoint,
    selectPointByIndex,
    isCopied,
    copyCoords,
    getPointStatusBadge,
    closePointPopup,
    closePhotoPopup,
    fitTrackBounds,
    rebuildFeatures,
  }
}
