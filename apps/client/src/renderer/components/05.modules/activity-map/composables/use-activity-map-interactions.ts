import type { Map as OlMap } from 'ol'
import type { FeatureLike } from 'ol/Feature'
import type { Ref } from 'vue'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Feature, Overlay } from 'ol'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

interface UseActivityMapInteractionsOptions {
  hoverPopupRef: Ref<HTMLElement | null>
  markers: Ref<MapMarker[]>
}

export function useActivityMapInteractions(options: UseActivityMapInteractionsOptions) {
  const { hoverPopupRef, markers } = options

  const mapInstance = shallowRef<OlMap | null>(null)
  const hoverOverlay = shallowRef<Overlay | null>(null)
  const hoveredActivity = ref<any | null>(null)
  const isTooltipHovered = ref(false)

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null

  function getCustomMarkerStyle(feature: FeatureLike) {
    const isHovered = feature.getProperties()?.id === hoveredActivity.value?.id

    return new Style({
      image: new CircleStyle({
        radius: isHovered ? 8 : 6,
        fill: new Fill({
          color: '#F43F5E',
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 2,
        }),
      }),
      zIndex: isHovered ? 100 : 1,
    })
  }

  function applyCustomMarkerStyle(map: OlMap) {
    const layers = map.getLayers().getArray()
    const vectorLayer = layers.find(l => l instanceof VectorLayer) as VectorLayer<any>

    if (vectorLayer) {
      vectorLayer.setStyle(getCustomMarkerStyle)
    }
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
      if (!isTooltipHovered.value) {
        clearHoverState()
      }
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

    applyCustomMarkerStyle(map)

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
      if (mapTarget) {
        mapTarget.style.cursor = hit ? 'pointer' : ''
      }

      if (hit) {
        const feature = hit as FeatureLike
        const properties = feature.getProperties()

        if (properties) {
          if (hoverTimeout) {
            clearTimeout(hoverTimeout)
            hoverTimeout = null
          }

          hoveredActivity.value = properties
          const geometry = feature.getGeometry()
          if (geometry instanceof Point) {
            hoverOverlay.value?.setPosition(geometry.getCoordinates())
          }

          if (feature instanceof Feature) {
            feature.changed()
          }
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
    view.animate({
      center: fromLonLat(coords),
      zoom,
      duration: 500,
    })
  }

  watch(markers, () => {
    mapInstance.value?.render()
  }, { deep: true })

  return {
    hoveredActivity,
    initializeInteractions,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    focusOnLocation,
  }
}
