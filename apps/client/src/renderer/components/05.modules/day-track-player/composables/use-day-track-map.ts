import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, PointStatusBadge, RenderSegment, SelectedPointInfo, ViewMode } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useKitMap } from '~/components/01.kit/kit-map/composables/use-kit-map'
import { normalizeSplineVertices, splitTrackIntoLegs } from '~/shared/services/tracking/track-processing'
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

  const ROUTE_SOURCE_ID = 'day-track-route-source'
  const PROGRESS_SOURCE_ID = 'day-track-progress-source'
  const POINTS_SOURCE_ID = 'day-track-points-source'

  const ROUTE_LAYER_ID = 'day-track-route-layer'
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
        },
      })
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
              color: `${ACTIVITY_COLORS[seg.activity]}88`,
              width: seg.activity === 'rail' ? 5 : 3.5,
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

    for (let i = 0; i < pointsList.length; i++) {
      const p = pointsList[i]
      pointFeatures.push({
        type: 'Feature',
        properties: {
          pointIndex: i + 1,
          totalPoints: pointsList.length,
          color: ACTIVITY_COLORS[p.activity] || '#2196f3',
          radius: isPointsMode ? 5.5 : 4,
          strokeWidth: isPointsMode ? 1.5 : 1,
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

    map.on('click', POINTS_LAYER_ID, (e) => {
      const feature = e.features?.[0]
      if (feature && feature.properties?.pointData) {
        try {
          const pData = JSON.parse(feature.properties.pointData) as DayPoint
          selectedPoint.value = {
            point: pData,
            index: feature.properties.pointIndex || 1,
            total: feature.properties.totalPoints || 1,
          }
          if (pointPopup) {
            pointPopup.setLngLat([pData.lng, pData.lat]).addTo(map)
          }
        }
        catch (err) {
          console.error('[useDayTrackMap] Ошибка парсинга данных точки:', err)
        }
      }
    })

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [POINTS_LAYER_ID] })
      if (features.length === 0) {
        closePointPopup()
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
