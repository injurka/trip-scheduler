import type PointGeom from 'ol/geom/Point'
import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, PointStatusBadge, RenderSegment, SelectedPointInfo, ViewMode } from '../models/types'
import { Feature, Overlay } from 'ol'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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
    currentActivityColor,
    t,
    isPlaying,
    isFollowCamera,
    viewMode,
  } = options

  const { mapInstance, isMapReady, initMap } = useKitMap()
  const routeSource = shallowRef(new VectorSource())
  const progressSource = shallowRef(new VectorSource())
  const markerFeature = shallowRef<Feature<PointGeom> | null>(null)
  const mapCenter: [number, number] = [37.6176, 55.7558]

  let pointOverlay: Overlay | null = null
  let playbackOverlay: Overlay | null = null

  const selectedPoint = ref<SelectedPointInfo | null>(null)
  const isCopied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

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
    pointOverlay?.setPosition(undefined)
  }

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

    const rawPoints = dayData.value?.points || []

    // Используем объединенные стояночные точки (радиус 5м)
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

    if (markerFeature.value) {
      routeSource.value.addFeature(markerFeature.value)
    }

    // Интерактивные маркеры для каждой объединенной точки в обоих режимах
    const isPointsMode = viewMode.value === 'points'
    const pointsList = displayPoints.value
    for (let i = 0; i < pointsList.length; i++) {
      const p = pointsList[i]
      const ptFeature = new Feature({
        geometry: new Point(fromLonLat([p.lng, p.lat])),
      })
      ptFeature.set('pointData', p)
      ptFeature.set('pointIndex', i + 1)
      ptFeature.set('totalPoints', pointsList.length)
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

  onMounted(async () => {
    if (!mapHost.value)
      return

    await initMap(mapHost.value, null, { center: mapCenter, zoom: 11 })

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
          margin: 160,
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
        const pData = feat.get('pointData') as DayPoint | undefined
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

  watch([renderSegments, viewMode], () => rebuildFeatures())

  onBeforeUnmount(() => {
    if (copyTimer)
      clearTimeout(copyTimer)
    mapInstance.value?.setTarget(undefined)
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
