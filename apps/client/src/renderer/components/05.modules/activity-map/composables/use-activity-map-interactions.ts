import type { Map as OlMap } from 'ol'
import type { FeatureLike } from 'ol/Feature'
import type { Ref } from 'vue'
import type { ActivityItem } from '../ui/activity-map.vue'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Feature, Overlay } from 'ol'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import { Cluster, Vector as VectorSource } from 'ol/source'
import { Circle as CircleStyle, Fill, Icon as OlIcon, Stroke, Style, Text } from 'ol/style'

interface UseActivityMapInteractionsOptions {
  hoverPopupRef: Ref<HTMLElement | null>
  markers: Ref<MapMarker[]>
}

export function useActivityMapInteractions(options: UseActivityMapInteractionsOptions) {
  const { hoverPopupRef, markers } = options

  const mapInstance = shallowRef<OlMap | null>(null)
  const hoverOverlay = shallowRef<Overlay | null>(null)
  const hoveredActivity = ref<ActivityItem | null>(null)
  const isTooltipHovered = ref(false)

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null

  const clusterSource = new Cluster({
    distance: 40,
    source: new VectorSource(),
  })

  const clusterLayer = new VectorLayer({
    source: clusterSource,
    zIndex: 10,
  })

  // Кэш стилей для оптимизации
  const styleCache: Record<string, Style> = {}

  function getStatusColor(status: ActivityItem['status']) {
    switch (status) {
      case 'active': return '#F43F5E' // Красный (Идет сейчас)
      case 'upcoming': return '#3B82F6' // Синий (Ожидается)
      case 'past': return '#9CA3AF' // Серый (Прошло)
      case 'static': return '#10B981' // Зеленый (Статика/Место)
      default: return '#3B82F6'
    }
  }

  function createMarkerStyle(feature: FeatureLike) {
    const features = feature.get('features')
    const size = features ? features.length : 1

    if (size > 1) {
      // Стиль кластера
      const cacheKey = `cluster-${size}`
      if (!styleCache[cacheKey]) {
        styleCache[cacheKey] = new Style({
          image: new CircleStyle({
            radius: 16,
            stroke: new Stroke({ color: '#fff', width: 2 }),
            fill: new Fill({ color: 'rgba(59, 130, 246, 0.8)' }),
          }),
          text: new Text({
            text: size.toString(),
            fill: new Fill({ color: '#fff' }),
            font: 'bold 14px sans-serif',
          }),
        })
      }
      return styleCache[cacheKey]
    }

    // Стиль одиночной метки
    const payload = features ? features[0].get('payload') as ActivityItem : feature.get('payload') as ActivityItem
    if (!payload)
      return new Style()

    const isHovered = payload.id === hoveredActivity.value?.id
    const color = getStatusColor(payload.status)
    const isStatic = payload.isStatic
    const cacheKey = `pin-${color}-${isHovered}-${isStatic}`

    if (!styleCache[cacheKey]) {
      if (isStatic) {
        // Стандартный Pin для локаций
        const svg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="3" fill="white"/></svg>`
        styleCache[cacheKey] = new Style({
          image: new OlIcon({
            src: `data:image/svg+xml;base64,${btoa(svg)}`,
            scale: isHovered ? 1.2 : 1,
            anchor: [0.5, 1],
          }),
          zIndex: isHovered ? 100 : 1,
        })
      }
      else {
        // Кружок для событий во времени (если активно - добавим пульсацию через CSS, здесь только статика)
        styleCache[cacheKey] = new Style({
          image: new CircleStyle({
            radius: isHovered ? 10 : 8,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#FFFFFF', width: 2 }),
          }),
          zIndex: isHovered ? 100 : 1,
        })
      }
    }
    return styleCache[cacheKey]
  }

  function syncMarkers() {
    const source = clusterSource.getSource()
    if (!source)
      return

    source.clear()
    const features = markers.value.map((marker) => {
      const f = new Feature({
        geometry: new Point(fromLonLat([marker.coords.lon, marker.coords.lat])),
      })
      f.setProperties({ id: marker.id, payload: marker.payload })
      return f
    })
    source.addFeatures(features)
  }

  function clearHoverState() {
    hoverOverlay.value?.setPosition(undefined)
    hoveredActivity.value = null
    mapInstance.value?.render()
  }

  function startCloseTimeout() {
    if (hoverTimeout)
      clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      if (!isTooltipHovered.value)
        clearHoverState()
    }, 300)
  }

  function onTooltipMouseEnter() {
    isTooltipHovered.value = true
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
  }

  function onTooltipMouseLeave() {
    isTooltipHovered.value = false
    startCloseTimeout()
  }

  function initializeInteractions(map: OlMap) {
    mapInstance.value = map

    // Находим стандартный векторный слой KitMap и убираем его, заменяем на кластерный
    const layers = map.getLayers().getArray()
    const kitVectorLayer = layers.find(l => l instanceof VectorLayer && l.getZIndex() === 10)
    if (kitVectorLayer)
      map.removeLayer(kitVectorLayer)

    clusterLayer.setStyle(createMarkerStyle)
    map.addLayer(clusterLayer)

    syncMarkers()

    if (hoverPopupRef.value) {
      hoverOverlay.value = new Overlay({
        element: hoverPopupRef.value,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -15],
        insertFirst: false,
      })
      map.addOverlay(hoverOverlay.value)
    }

    map.on('pointermove', (evt) => {
      if (evt.dragging) {
        clearHoverState()
        return
      }

      const pixel = map.getEventPixel(evt.originalEvent)
      const hit = map.forEachFeatureAtPixel(pixel, feature => feature)

      const mapTarget = map.getTarget() as HTMLElement
      if (mapTarget)
        mapTarget.style.cursor = hit ? 'pointer' : ''

      if (hit) {
        const features = hit.get('features')
        if (features && features.length === 1) { // Показываем ховер только для одиночной метки
          if (hoverTimeout) {
            clearTimeout(hoverTimeout)
            hoverTimeout = null
          }

          const payload = features[0].get('payload')
          hoveredActivity.value = payload
          const geometry = hit.getGeometry()
          if (geometry instanceof Point) {
            hoverOverlay.value?.setPosition(geometry.getCoordinates())
          }
          clusterLayer.changed()
        }
        else {
          clearHoverState()
        }
      }
      else {
        startCloseTimeout()
      }
    })
  }

  function focusOnLocation(coords: [number, number], zoom = 14) {
    if (!mapInstance.value)
      return
    const view = mapInstance.value.getView()
    view.animate({ center: fromLonLat(coords), zoom, duration: 500 })
  }

  watch(markers, syncMarkers, { deep: true })

  return {
    hoveredActivity,
    initializeInteractions,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    focusOnLocation,
  }
}
