import type { FeatureLike } from 'ol/Feature'
import type { KitMapOptions, MapMarker } from '../models/types'
import { Feature, Overlay } from 'ol'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { resolveApiUrl } from '~/shared/lib/url'
import { createMarkerStyle, toMapCoord } from '~/shared/services/geo'
import { useBaseMap } from './use-base-map'

export function useKitMap() {
  const baseMap = useBaseMap()

  const vectorSource = new VectorSource()
  const searchVectorSource = new VectorSource()

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: createMarkerStyle({ color: '#3399CC' }),
    zIndex: 10,
  })

  const searchVectorLayer = new VectorLayer({
    source: searchVectorSource,
    style: createMarkerStyle({ color: '#FF5252' }),
    zIndex: 11,
  })

  const initMap = async (
    container: HTMLElement,
    popupEl?: HTMLElement | null,
    options: KitMapOptions = { center: [0, 0] },
  ): Promise<void> => {
    const popup = popupEl
      ? new Overlay({
          element: popupEl,
          positioning: 'bottom-center',
          offset: [0, -45],
          stopEvent: false,
          autoPan: options.autoPan === false ? false : { animation: { duration: 250 } },
        })
      : null

    await baseMap.initMap({
      container,
      center: options.center,
      zoom: options.zoom || 12,
      initialSource: options.initialSource,
      extraLayers: [vectorLayer, searchVectorLayer],
      extraOverlays: popup ? [popup] : [],
      showAttribution: false,
    })

    if (popup && popupEl && baseMap.mapInstance.value) {
      baseMap.mapInstance.value.on('pointermove', (evt) => {
        if (evt.dragging) {
          popup.setPosition(undefined)
          return
        }
        const pixel = baseMap.mapInstance.value?.getEventPixel(evt.originalEvent)
        if (!pixel)
          return

        const feature = baseMap.mapInstance.value?.forEachFeatureAtPixel(pixel, f => f)
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
    }
  }

  const updateMarkers = (markers: MapMarker[]) => {
    vectorSource.clear()
    if (!markers.length)
      return

    const features = markers.map((marker) => {
      const feature = new Feature({
        geometry: new Point(toMapCoord([marker.coords.lon, marker.coords.lat])),
      })
      feature.set('imageUrl', marker.imageUrl)
      feature.setProperties(marker.payload || {})
      return feature
    })

    vectorSource.addFeatures(features)
  }

  const fitViewToMarkers = () => {
    if (vectorSource.getFeatures().length === 0)
      return
    baseMap.fitExtent(vectorSource.getExtent())
  }

  const setSearchResult = (coords: { lat: number, lon: number }) => {
    searchVectorSource.clear()
    const feature = new Feature({
      geometry: new Point(toMapCoord([coords.lon, coords.lat])),
    })
    searchVectorSource.addFeature(feature)
    baseMap.flyTo(coords.lon, coords.lat, 14, 800)
  }

  const clearSearchResult = () => {
    searchVectorSource.clear()
  }

  return {
    mapInstance: baseMap.mapInstance,
    isMapReady: baseMap.isMapReady,
    initMap,
    setTileSource: baseMap.setTileSource,
    zoomIn: baseMap.zoomIn,
    zoomOut: baseMap.zoomOut,
    updateMarkers,
    fitViewToMarkers,
    setSearchResult,
    clearSearchResult,
  }
}
