import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, PointStatusBadge, RenderSegment, SelectedPointInfo, ViewMode } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { haversineM, normalizeSplineVertices, splitTrackIntoLegs } from '~/shared/services/tracking/track-processing'
import { ACTIVITY_COLORS } from '../models/types'

export interface UseDayTrackMapOptions {
  mapHost: Ref<HTMLElement | null>
  popupHost: Ref<HTMLElement | null>
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
}

export function useDayTrackMap(options: UseDayTrackMapOptions) {
  const {
    mapHost,
    popupHost,
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
  } = options

  const { mapInstance, isMapReady, initMap } = useKitMap()
  const mapCenter: [number, number] = [37.6176, 55.7558]

  let playbackMarker: maplibregl.Marker | null = null
  let pointPopup: maplibregl.Popup | null = null

  const selectedPoint = ref<SelectedPointInfo | null>(null)
  const isCopied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  // Последний отрисованный набор точек и режим — нужны обработчику клика
  // (в «Маршруте» слой точек отфильтрован, поэтому ищем ближайшую точку вручную).
  let renderedPoints: DayPoint[] = []
  let lastIsPointsMode = true

  const ROUTE_SOURCE_ID = 'day-track-route-source'
  const PROGRESS_SOURCE_ID = 'day-track-progress-source'
  const POINTS_SOURCE_ID = 'day-track-points-source'

  const ROUTE_LAYER_ID = 'day-track-route-layer'
  const ROUTE_CASING_LAYER_ID = 'day-track-route-casing-layer'
  const PROGRESS_GLOW_LAYER_ID = 'day-track-progress-glow-layer'
  const PROGRESS_LINE_LAYER_ID = 'day-track-progress-line-layer'
  const POINTS_LAYER_ID = 'day-track-points-layer'

  function copyCoords(p: DayPoint) {
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

  function getPointStatusBadge(p: DayPoint): PointStatusBadge {
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

  function updateProgressLine() {
    const map = mapInstance.value
    if (!map || !map.getSource(PROGRESS_SOURCE_ID))
      return

    if (t.value === 0 || !dayData.value?.points?.length) {
      const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(emptyGeojson)
      return
    }

    const covered = dayData.value.points
      .filter(p => p.tsUtc <= t.value)
      .sort((a, b) => a.tsUtc - b.tsUtc)

    if (covered.length < 2) {
      const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      ;(map.getSource(PROGRESS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(emptyGeojson)
      return
    }

    const features: GeoJSON.Feature[] = []
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
    for (const p of displayPoints.value) {
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

          routeFeatures.push({
            type: 'Feature',
            properties: {
              color: ACTIVITY_COLORS[seg.activity] || ACTIVITY_COLORS.unknown,
              width: seg.activity === 'rail' ? 6 : 4.5,
            },
            geometry: {
              type: 'LineString',
              coordinates: smooth.map(p => [p.lng, p.lat]),
            },
          })
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
    const pointsList = displayPoints.value
    const pointFeatures: GeoJSON.Feature[] = []

    renderedPoints = pointsList
    lastIsPointsMode = isPointsMode

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
        const isAnchor = waypointRefs.has(p) || p.activity === 'still'
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
      pointFeatures.push({
        type: 'Feature',
        properties: {
          pointIndex: i + 1,
          totalPoints: pointsList.length,
          kind: isWaypoint ? 'waypoint' : 'track',
          color: ACTIVITY_COLORS[p.activity] || '#2196f3',
          radius: isPointsMode ? 5.5 : (isWaypoint ? 5 : 3),
          strokeWidth: isPointsMode ? 1.5 : (isWaypoint ? 1.5 : 1),
          pointData: JSON.stringify(p),
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

    // В режиме «Маршрут» показываем только ориентиры (линия несёт сам трек),
    // в режиме «Точки» — все точки, включая Bezier-опорные.
    if (map.getLayer(POINTS_LAYER_ID)) {
      map.setFilter(POINTS_LAYER_ID, isPointsMode ? null : ['==', ['get', 'kind'], 'waypoint'])
    }

    updateProgressLine()

    if (renderSegments.value.length > 0 || rawPoints.length > 0) {
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

    // Клик по карте — единственный обработчик для попапа точки. В режиме «Маршрут»
    // слой точек отфильтрован до ориентиров, поэтому как fallback ищем ближайшую
    // точку дня в радиусе ~12px: любая точка остаётся кликабельной.
    map.on('click', (e) => {
      let pData: DayPoint | null = null
      let idx = 1

      const feature = map.queryRenderedFeatures(e.point, { layers: [POINTS_LAYER_ID] })[0]
      if (feature?.properties?.pointData) {
        try {
          pData = JSON.parse(feature.properties.pointData) as DayPoint
          idx = feature.properties.pointIndex || 1
        }
        catch (err) {
          console.error('[useDayTrackMap] Ошибка парсинга данных точки:', err)
        }
      }

      if (!pData && !lastIsPointsMode && renderedPoints.length > 0) {
        const clicked = map.unproject(e.point)
        const metersPerPixel = 156_543.03392 * Math.cos((clicked.lat * Math.PI) / 180) / 2 ** map.getZoom()
        const maxDistM = Math.max(60, metersPerPixel * 12)
        let best = Number.POSITIVE_INFINITY
        for (let i = 0; i < renderedPoints.length; i++) {
          const cand = renderedPoints[i]
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
      if (isFollowCamera.value && isPlaying.value) {
        mapInstance.value.easeTo({
          center: [p.lng, p.lat],
          duration: 100,
        })
      }
    }
  })

  watch(t, () => {
    updateProgressLine()
  })

  watch([renderSegments, viewMode], () => rebuildFeatures())

  onBeforeUnmount(() => {
    if (copyTimer)
      clearTimeout(copyTimer)
    if (playbackMarker) {
      playbackMarker.remove()
      playbackMarker = null
    }
    if (pointPopup) {
      pointPopup.remove()
      pointPopup = null
    }
  })

  return {
    selectedPoint,
    isCopied,
    copyCoords,
    getPointStatusBadge,
    closePointPopup,
    fitTrackBounds,
    rebuildFeatures,
  }
}
