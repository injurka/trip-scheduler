import type { FeatureLike } from 'ol/Feature'
import type { Ref } from 'vue'
import type { KitMapOptions, MapMarker, TileSource } from '../models/types'
import { Feature, Map, Overlay, View } from 'ol'
import Point from 'ol/geom/Point'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Icon as OlIcon, Style } from 'ol/style'
import { resolveApiUrl } from '~/shared/lib/url'

export function useKitMap() {
  const mapInstance: Ref<Map | null> = shallowRef(null)
  const isMapReady = ref(false)

  const tileLayerRef = shallowRef<TileLayer<TileSource> | null>(null)
  const vectorSource = new VectorSource()

  let resizeObserver: ResizeObserver | null = null

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
    zIndex: 10,
  })

  const initMap = (container: HTMLElement, popupEl: HTMLElement, options: KitMapOptions): Promise<void> => {
    return new Promise((resolve) => {
      if (!container) {
        resolve()
        return
      }

      const createMap = async () => {
        try {
          const popup = new Overlay({
            element: popupEl,
            positioning: 'bottom-center',
            offset: [0, -45],
            stopEvent: false,
            autoPan: options.autoPan === false ? false : { animation: { duration: 250 } },
          })

          const initialSource = options.initialSource || new OSM()

          tileLayerRef.value = new TileLayer({
            source: initialSource,
          })

          mapInstance.value = new Map({
            target: container,
            layers: [tileLayerRef.value, vectorLayer],
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
            const pixel = mapInstance.value?.getEventPixel(evt.originalEvent)
            if (!pixel)
              return

            const feature = mapInstance.value?.forEachFeatureAtPixel(pixel, f => f)

            if (!feature) {
              popup.setPosition(undefined)
              return
            }

            const imageUrl = (feature as FeatureLike).get('imageUrl')
            const resolvedUrl = resolveApiUrl(imageUrl)

            if (resolvedUrl && popupEl) {
              popupEl.innerHTML = `<img src="${resolvedUrl}" style="width:200px; height:120px; object-fit: cover; border-radius:4px;" />`
              const geometry = (feature as Feature).getGeometry()
              if (geometry?.getType() === 'Point') {
                popup.setPosition((geometry as Point).getCoordinates())
              }
            }
          })

          isMapReady.value = true
          resolve()
        }
        catch (error) {
          console.error('Failed to initialize map:', error)
          resolve()
        }
      }

      if (container.clientWidth > 0 && container.clientHeight > 0) {
        createMap()
        resizeObserver = new ResizeObserver(() => {
          mapInstance.value?.updateSize()
        })
        resizeObserver.observe(container)
      }
      else {
        resizeObserver = new ResizeObserver(() => {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            if (!mapInstance.value) {
              createMap()
            }
            else {
              mapInstance.value.updateSize()
            }
          }
        })
        resizeObserver.observe(container)
      }
    })
  }

  const setTileSource = (source: TileSource) => {
    if (tileLayerRef.value) {
      tileLayerRef.value.setSource(source)
    }
  }

  const updateMarkers = (markers: MapMarker[]) => {
    vectorSource.clear()
    if (!markers.length)
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

    const extent = vectorSource.getExtent()
    mapInstance.value.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500,
      maxZoom: 15,
    })
  }

  const zoomIn = () => {
    const view = mapInstance.value?.getView()
    if (view)
      view.animate({ zoom: (view.getZoom() || 10) + 1, duration: 250 })
  }

  const zoomOut = () => {
    const view = mapInstance.value?.getView()
    if (view)
      view.animate({ zoom: (view.getZoom() || 10) - 1, duration: 250 })
  }

  onUnmounted(() => {
    if (resizeObserver)
      resizeObserver.disconnect()
    if (mapInstance.value)
      mapInstance.value.setTarget(undefined)
  })

  return {
    mapInstance,
    isMapReady: readonly(isMapReady),
    initMap,
    setTileSource,
    zoomIn,
    zoomOut,
    updateMarkers,
    fitViewToMarkers,
  }
}
