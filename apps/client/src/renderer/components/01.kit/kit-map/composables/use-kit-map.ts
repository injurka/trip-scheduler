import type { Ref } from 'vue'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Feature, Map, Overlay, View } from 'ol'
import Point from 'ol/geom/Point'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Icon as OlIcon, Style } from 'ol/style'

export interface KitMapOptions {
  center: [number, number]
  zoom?: number
  autoPan?: boolean
}

export function useKitMap() {
  const mapInstance: Ref<Map | null> = ref(null)
  const isMapReady = ref(false)
  let resizeObserver: ResizeObserver | null = null

  const vectorSource = new VectorSource()

  const defaultMarkerSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#3399CC"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
      image: new OlIcon({
        src: `data:image/svg+xml;base64,${btoa(defaultMarkerSvg)}`,
        scale: 1.5,
        anchor: [0.5, 1],
      }),
    }),
  })

  const initMap = async (container: HTMLElement, popupEl: HTMLElement, options: KitMapOptions) => {
    if (!container) {
      console.error('Map container is required')
      return
    }
    await nextTick()

    try {
      const popup = new Overlay({
        element: popupEl,
        autoPan: options.autoPan === false
          ? false
          : {
              animation: {
                duration: 250,
              },
            },
      })

      mapInstance.value = new Map({
        target: container,
        layers: [new TileLayer({ source: new OSM() }), vectorLayer],
        view: new View({
          center: fromLonLat(options.center),
          zoom: options.zoom || 12,
        }),
        controls: [],
        overlays: [popup],
      })

      mapInstance.value.on('pointermove', (evt) => {
        if (evt.dragging) {
          popup.setPosition(undefined)
          return
        }

        const feature = mapInstance.value?.forEachFeatureAtPixel(evt.pixel, f => f)
        const popupElement = popup.getElement()
        if (!popupElement)
          return

        if (feature) {
          const imageUrl = feature.get('imageUrl')
          if (imageUrl) {
            popupElement.innerHTML = `<img src="${resolveApiUrl(imageUrl)}" alt="Marker Preview" style="max-width:150px; max-height:150px; display:block; border-radius:var(--r-xs);" />`
            popup.setPosition(evt.coordinate)
          }
          else {
            popup.setPosition(undefined)
          }
        }
        else {
          popup.setPosition(undefined)
        }
      })

      mapInstance.value.once('postrender', () => {
        isMapReady.value = true
        mapInstance.value?.updateSize()
      })

      resizeObserver = new ResizeObserver(() => {
        mapInstance.value?.updateSize()
      })
      resizeObserver.observe(container)
    }
    catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }

  const updateMarkers = (markers: MapMarker[]) => {
    vectorSource.clear()
    if (markers.length === 0)
      return

    const features = markers.map((marker) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([marker.coords.lon, marker.coords.lat])),
      })
      feature.set('imageUrl', marker.imageUrl)
      feature.setProperties(marker.payload || {})
      return feature
    })

    vectorSource.addFeatures(features)
  }

  const fitViewToMarkers = () => {
    if (!mapInstance.value || vectorSource.getFeatures().length === 0)
      return

    mapInstance.value.getView().fit(vectorSource.getExtent(), {
      padding: [100, 100, 100, 100],
      duration: 500,
      maxZoom: 15,
    })
  }

  const destroyMap = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (mapInstance.value) {
      mapInstance.value.setTarget(undefined)
      mapInstance.value = null
      isMapReady.value = false
    }
  }

  const zoomIn = () => {
    const view = mapInstance.value?.getView()
    const currentZoom = view?.getZoom()
    if (view && currentZoom !== undefined)
      view.animate({ zoom: currentZoom + 1, duration: 250 })
  }

  const zoomOut = () => {
    const view = mapInstance.value?.getView()
    const currentZoom = view?.getZoom()
    if (view && currentZoom !== undefined)
      view.animate({ zoom: currentZoom - 1, duration: 250 })
  }

  onUnmounted(destroyMap)

  return {
    mapInstance,
    isMapReady: readonly(isMapReady),
    initMap,
    zoomIn,
    zoomOut,
    updateMarkers,
    fitViewToMarkers,
  }
}
