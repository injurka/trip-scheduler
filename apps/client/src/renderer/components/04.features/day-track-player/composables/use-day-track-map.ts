import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, PointStatusBadge, RenderSegment, SelectedPointInfo, TrackPhoto, TrackPhotoCluster, ViewMode } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { haversineM, splitTrackIntoLegs } from '~/shared/services/tracking/track-processing'
import { ACTIVITY_COLORS } from '../models/types'

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
  let photoClustersTimer: ReturnType<typeof setTimeout> | null = null
  let activePhotoMarkers: Array<{
    marker: maplibregl.Marker
    element: HTMLElement
    photos: TrackPhoto[]
  }> = []
  const CLUSTER_RADIUS_PX = 46

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
    const pts = dayData.value?.points
    if (!pts || pts.length === 0) {
      if (renderSegments.value.length === 0)
        return
    }

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

      if (minLon !== Number.POSITIVE_INFINITY) {
        mapInstance.value?.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          {
            padding: { top: 60, right: 60, bottom: 140, left: 60 },
            maxZoom: 16,
            duration: 600,
          },
        )
      }
    }
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

    const pts = dayData.value?.points
    if (t.value === 0 || !pts || pts.length === 0) {
      const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(emptyGeojson)
      return
    }

    // Быстрый бинарный поиск границы пройденных точек без лишней фильтрации и сортировки
    let low = 0
    let high = pts.length - 1
    let coveredIdx = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (pts[mid].tsUtc <= t.value) {
        coveredIdx = mid
        low = mid + 1
      }
      else {
        high = mid - 1
      }
    }

    if (coveredIdx < 1) {
      const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(emptyGeojson)
      return
    }

    const covered = pts.slice(0, coveredIdx + 1)
    const features: GeoJSON.Feature[] = []
    const legs = splitTrackIntoLegs(covered)

    for (const leg of legs) {
      if (leg.points.length < 2)
        continue
      const smooth = leg.points
      if (smooth.length < 2)
        continue

      const coords = smooth.map(p => [p.lng, p.lat])
      const act = leg.points[leg.points.length - 1]?.activity || 'unknown'
      const color = ACTIVITY_COLORS[act] || '#2196f3'

      features.push({
        type: 'Feature',
        properties: {
          color,
          glowColor: `${color}40`,
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      })
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    }

    ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson)
  }

  function ensureLayers() {
    const map = mapInstance.value
    if (!map)
      return

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

  function createPhotoMarkerElement(
    cluster: TrackPhotoCluster,
    onPhotoClick: (p: TrackPhoto) => void,
    onClusterClick: (photos: TrackPhoto[]) => void,
  ): HTMLElement {
    const el = document.createElement('div')
    el.className = 'day-track-photo-marker'

    const img = document.createElement('img')
    img.src = cluster.representativePhoto.thumbnailUrl
    img.alt = cluster.representativePhoto.title || 'Фото'
    img.className = 'photo-marker-img'
    img.loading = 'lazy'
    el.appendChild(img)

    if (cluster.count > 1) {
      const badge = document.createElement('span')
      badge.className = 'photo-marker-badge'
      badge.textContent = String(cluster.count)
      el.appendChild(badge)
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
        el.appendChild(icon)
      }
      else if (photo.source === 'interpolated') {
        const icon = document.createElement('span')
        icon.className = 'photo-marker-source-icon source-interpolated'
        icon.title = 'Привязано по треку'
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9"><path fill="#2563eb" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h-4V7h2v4h2z"/></svg>`
        el.appendChild(icon)
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

  function schedulePhotoClustersUpdate() {
    if (photoClustersTimer)
      return
    photoClustersTimer = setTimeout(() => {
      photoClustersTimer = null
      updatePhotoClusters()
    }, 40)
  }

  function updatePhotoClusters() {
    const map = mapInstance.value
    if (!map || !isMapReady.value)
      return

    const photos = locatedPhotos?.value || []
    if (!isPhotosVisible?.value || photos.length === 0) {
      clearPhotoMarkers()
      return
    }

    // 1. Проецируем координаты в экранные пиксели
    const projected: Array<{ photo: TrackPhoto, x: number, y: number }> = []
    for (const photo of photos) {
      const p = map.project([photo.lng, photo.lat])
      projected.push({ photo, x: p.x, y: p.y })
    }

    // 2. Жадная кластеризация по расстоянию на экране
    const clusters: TrackPhotoCluster[] = []
    const visited = new Uint8Array(projected.length)

    for (let i = 0; i < projected.length; i++) {
      if (visited[i])
        continue
      visited[i] = 1
      const p1 = projected[i]
      const clusterPhotos: TrackPhoto[] = [p1.photo]
      let sumLng = p1.photo.lng
      let sumLat = p1.photo.lat

      for (let j = i + 1; j < projected.length; j++) {
        if (visited[j])
          continue
        const p2 = projected[j]
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
        if (dist < CLUSTER_RADIUS_PX) {
          visited[j] = 1
          clusterPhotos.push(p2.photo)
          sumLng += p2.photo.lng
          sumLat += p2.photo.lat
        }
      }

      clusters.push({
        id: `cluster-${i}-${clusterPhotos.length}`,
        lat: sumLat / clusterPhotos.length,
        lng: sumLng / clusterPhotos.length,
        photos: clusterPhotos,
        count: clusterPhotos.length,
        representativePhoto: clusterPhotos[0],
      })
    }

    // 3. Пересоздаем маркеры на карте
    clearPhotoMarkers()

    for (const cluster of clusters) {
      const el = createPhotoMarkerElement(
        cluster,
        (photo) => {
          closePointPopup()
          onSelectPhoto?.(photo)
          if (photoPopup && mapInstance.value) {
            photoPopup.setLngLat([photo.lng, photo.lat]).addTo(mapInstance.value)
          }
        },
        (clusterPhotos) => {
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
        },
      )

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

    if (t.value > 0) {
      for (const item of activePhotoMarkers) {
        const isNear = item.photos.some(p => Math.abs(t.value - p.tsUtc) < 45_000)
        item.element.classList.toggle('is-playback-active', isNear)
      }
    }
  }

  function rebuildFeatures() {
    const map = mapInstance.value
    if (!map || !isMapReady.value)
      return

    ensureLayers()
    closePointPopup()

    const rawPoints = dayData.value?.points || []
    const routeFeatures: GeoJSON.Feature[] = []

    const uniquePoints: DayPoint[] = []
    for (const p of dayData.value?.rawPoints ?? displayPoints.value) {
      const prev = uniquePoints[uniquePoints.length - 1]
      if (!prev || Math.abs(prev.lat - p.lat) > 1e-6 || Math.abs(prev.lng - p.lng) > 1e-6) {
        uniquePoints.push(p)
      }
    }

    if (viewMode.value === 'route') {
      for (const seg of renderSegments.value) {
        if (seg.activity === 'still')
          continue
        const coords = seg.geometry || seg.points.map(p => [p.lng, p.lat])
        if (coords.length < 2)
          continue

        routeFeatures.push({
          type: 'Feature',
          properties: {
            color: ACTIVITY_COLORS[seg.activity] || ACTIVITY_COLORS.unknown,
            width: seg.activity === 'rail' ? 6 : 4.5,
          },
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        })
      }
    }
    else if (viewMode.value === 'points') {
      const legs = splitTrackIntoLegs(uniquePoints)
      for (const leg of legs) {
        if (leg.points.length < 2)
          continue
        const smooth = leg.points
        if (smooth.length < 2)
          continue

        routeFeatures.push({
          type: 'Feature',
          properties: {
            color: 'rgba(59, 130, 246, 0.45)',
            width: 3,
          },
          geometry: {
            type: 'LineString',
            coordinates: smooth.map(p => [p.lng, p.lat]),
          },
        })
      }
    }

    const routeGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: routeFeatures,
    }
    ;(map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(routeGeojson)

    const isPointsMode = viewMode.value === 'points'
    const pointsList = isPointsMode ? dayData.value?.rawPoints ?? displayPoints.value : displayPoints.value
    const pointFeatures: GeoJSON.Feature[] = []

    renderedPoints = pointsList

    // Точки-ориентиры для режима «Маршрут». Кружок у каждого фикса превращал маршрут
    // в цепочку жирных точек поверх линии, поэтому в route-режиме оставляем только
    // смысловые точки: границы плеч (в т.ч. разрывы) и стоянки, прореженные по
    // расстоянию/времени — остальное рисует линия.
    const waypointRefs = new Set<DayPoint>()
    if (!isPointsMode) {
      const legs = splitTrackIntoLegs(pointsList)
      for (const leg of legs) {
        waypointRefs.add(leg.points[0])
        waypointRefs.add(leg.points[leg.points.length - 1])
      }
      let lastKept: DayPoint | null = null
      for (const p of pointsList) {
        const isAnchor = waypointRefs.has(p) || !!p.stop
        if (!isAnchor)
          continue
        if (lastKept) {
          const dM = haversineM(lastKept.lat, lastKept.lng, p.lat, p.lng)
          if (dM < 15 && p.tsUtc - lastKept.tsUtc < 30_000)
            continue
        }
        waypointRefs.add(p)
        lastKept = p
      }
    }

    for (let i = 0; i < pointsList.length; i++) {
      const p = pointsList[i]
      const isWaypoint = isPointsMode || waypointRefs.has(p)
      // В режиме «Маршрут» отправляем в GeoJSON только ориентиры (waypoint/stop),
      // чтобы не перегружать воркер MapLibre и память невидимыми точками.
      if (!isWaypoint)
        continue

      pointFeatures.push({
        type: 'Feature',
        properties: {
          pointIndex: i + 1,
          totalPoints: pointsList.length,
          stopLabel: p.stop ? `Пауза ${Math.round((p.stop.endedAt - p.stop.startedAt) / 60_000)} мин` : '',
          kind: isWaypoint ? 'waypoint' : 'track',
          color: ACTIVITY_COLORS[p.activity] || '#2196f3',
          radius: p.stop ? 9 : isPointsMode ? 4 : 5,
          strokeWidth: isPointsMode ? 1.5 : (p.stop ? 2 : 1.5),
        },
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat],
        },
      })
    }

    const pointsGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: pointFeatures,
    }
    ;(map.getSource(POINTS_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(pointsGeojson)
    if (!map.getLayer('day-track-stop-labels')) {
      map.addLayer({
        id: 'day-track-stop-labels',
        type: 'symbol',
        source: POINTS_SOURCE_ID,
        filter: ['!=', ['get', 'stopLabel'], ''],
        layout: { 'text-field': ['get', 'stopLabel'], 'text-size': 12, 'text-offset': [0, 1.6], 'text-anchor': 'top' },
        paint: { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      })
    }

    const areas: GeoJSON.Feature[] = []
    if (!isPointsMode) {
      const seenStopTimes = new Set<number>()
      for (const p of pointsList) {
        if (!p.stop)
          continue
        if (seenStopTimes.has(p.stop.startedAt))
          continue
        seenStopTimes.add(p.stop.startedAt)

        const ring = Array.from({ length: 49 }, (_, i) => {
          const angle = i * Math.PI * 2 / 48
          return [p.lng + Math.cos(angle) * p.stop!.radiusM / (111_320 * Math.max(0.01, Math.cos(p.lat * Math.PI / 180))), p.lat + Math.sin(angle) * p.stop!.radiusM / 111_320]
        })
        areas.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })
      }
    }
    const areaData: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: areas }
    if (!map.getSource('day-track-stop-areas'))
      map.addSource('day-track-stop-areas', { type: 'geojson', data: areaData })
    else
      (map.getSource('day-track-stop-areas') as maplibregl.GeoJSONSource).setData(areaData)
    if (!map.getLayer('day-track-stop-areas')) {
      map.addLayer({ id: 'day-track-stop-areas', type: 'fill', source: 'day-track-stop-areas', paint: {
        'fill-color': '#64748b',
        'fill-opacity': 0.13,
        'fill-outline-color': '#64748b',
      } }, POINTS_LAYER_ID)
    }

    // В режиме «Маршрут» показываем только ориентиры (линия несёт сам трек),
    // в режиме «Точки» — все точки, включая Bezier-опорные.
    if (map.getLayer(POINTS_LAYER_ID)) {
      map.setFilter(POINTS_LAYER_ID, isPointsMode ? null : ['==', ['get', 'kind'], 'waypoint'])
    }

    // Линию между фото не рисуем — маркеры достаточно информативны сами по себе
    const photos = (isPhotosVisible?.value && locatedPhotos?.value) ? locatedPhotos.value : []
    const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    ;(map.getSource(PHOTO_ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(emptyGeojson)

    scheduleProgressUpdate(true)
    schedulePhotoClustersUpdate()

    if (renderSegments.value.length > 0 || rawPoints.length > 0 || photos.length > 0) {
      fitTrackBounds()
    }
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
        offset: 16,
        closeButton: false,
        closeOnClick: false,
        className: 'day-track-photo-popup',
      }).setDOMContent(photoPopupHost.value)
    }

    map.on('move', schedulePhotoClustersUpdate)
    map.on('zoom', schedulePhotoClustersUpdate)

    // Клик по карте — обработчик для попапа точки.
    // На мобильных/тач устройствах используем bounding box (расширенный хитбокс в пикселях),
    // чтобы по маленьким точкам было легко попадать пальцем без их визуального раздувания.
    map.on('click', (e) => {
      closePhotoPopup()
      onSelectPhoto?.(null)

      let pData: DayPoint | null = null
      let idx = 1

      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
      const hitPadding = isTouch ? 24 : 10
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - hitPadding, e.point.y - hitPadding],
        [e.point.x + hitPadding, e.point.y + hitPadding],
      ]

      const features = map.queryRenderedFeatures(bbox, { layers: [POINTS_LAYER_ID] })
      if (features.length > 0) {
        // Находим ближайшую к центру тача/клика точку по экранным пикселям
        let closestFeature = features[0]
        let minScreenDistSq = Number.POSITIVE_INFINITY

        for (const f of features) {
          if (f.geometry.type === 'Point') {
            const coords = f.geometry.coordinates as [number, number]
            const screenPt = map.project(coords)
            const dx = screenPt.x - e.point.x
            const dy = screenPt.y - e.point.y
            const distSq = dx * dx + dy * dy
            if (distSq < minScreenDistSq) {
              minScreenDistSq = distSq
              closestFeature = f
            }
          }
        }

        const pIndex = Number(closestFeature.properties?.pointIndex)
        pData = renderedPoints[pIndex - 1] ?? null
        idx = pIndex
      }

      // Fallback: в режиме «Маршрут» (где отображаются только ключевые ориентиры)
      // или если пользователь нажал чуть в стороне от линии/точки, ищем ближайшую точку трека.
      if (!pData && renderedPoints.length > 0) {
        const clicked = map.unproject(e.point)
        const metersPerPixel = 156_543.03392 * Math.cos((clicked.lat * Math.PI) / 180) / 2 ** map.getZoom()
        const maxDistM = Math.max(isTouch ? 80 : 50, metersPerPixel * (isTouch ? 28 : 16))

        // Bounding box pre-check: быстро отсекаем точки далеко от клика
        const maxDeltaLat = maxDistM / 111_000
        const maxDeltaLng = maxDistM / (111_000 * Math.max(0.1, Math.cos((clicked.lat * Math.PI) / 180)))

        let best = Number.POSITIVE_INFINITY
        for (let i = 0; i < renderedPoints.length; i++) {
          const cand = renderedPoints[i]
          if (Math.abs(cand.lat - clicked.lat) > maxDeltaLat || Math.abs(cand.lng - clicked.lng) > maxDeltaLng)
            continue
          const dM = haversineM(clicked.lat, clicked.lng, cand.lat, cand.lng)
          if (dM < best) {
            best = dM
            pData = cand
            idx = i + 1
          }
        }
        if (best > maxDistM) {
          pData = null
        }
      }

      if (!pData) {
        closePointPopup()
        return
      }

      selectedPoint.value = {
        point: pData,
        index: idx,
        total: renderedPoints.length || 1,
      }
      if (pointPopup) {
        pointPopup.setLngLat([pData.lng, pData.lat]).addTo(map)
      }
    })

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
    if (activePhotoMarkers.length > 0 && curT > 0) {
      for (const item of activePhotoMarkers) {
        const isNear = item.photos.some(p => Math.abs(curT - p.tsUtc) < 45_000)
        item.element.classList.toggle('is-playback-active', isNear)
      }
    }
  })

  watch([renderSegments, viewMode], () => rebuildFeatures())

  if (locatedPhotos && isPhotosVisible) {
    watch([locatedPhotos, isPhotosVisible], () => {
      rebuildFeatures()
      schedulePhotoClustersUpdate()
    }, { deep: true })
  }

  onBeforeUnmount(() => {
    if (copyTimer)
      clearTimeout(copyTimer)
    if (progressTimer) {
      clearTimeout(progressTimer)
      progressTimer = null
    }
    if (photoClustersTimer) {
      clearTimeout(photoClustersTimer)
      photoClustersTimer = null
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
