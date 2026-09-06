import type { StyleSpecification } from 'maplibre-gl'
import type { KitMapOptions, MapMarker } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { resolveApiUrl } from '~/shared/lib/url'
import { createMarkerElement } from '~/shared/services/geo'
import { useBaseMap } from './use-base-map'

export function useKitMap() {
  const baseMap = useBaseMap()

  const markersMap = new Map<string, maplibregl.Marker>()
  let searchMarker: maplibregl.Marker | null = null

  const removeAllMarkers = () => {
    markersMap.forEach(marker => marker.remove())
    markersMap.clear()
  }

  const updateMarkers = (markers: MapMarker[]) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const newMarkerIds = new Set(markers.map(m => m.id))

    // Удаляем маркеры, которых больше нет в списке
    markersMap.forEach((marker, id) => {
      if (!newMarkerIds.has(id)) {
        marker.remove()
        markersMap.delete(id)
      }
    })

    if (!markers.length)
      return

    markers.forEach((marker) => {
      let markerInstance = markersMap.get(marker.id)

      if (!markerInstance) {
        const el = createMarkerElement({ color: '#3399CC', scale: 1.1 })

        markerInstance = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
        }).setLngLat([marker.coords.lon, marker.coords.lat])

        if (marker.imageUrl) {
          const resolvedUrl = resolveApiUrl(marker.imageUrl)
          if (resolvedUrl) {
            const popup = new maplibregl.Popup({
              offset: 28,
              closeButton: false,
              className: 'kit-map-image-popup',
            }).setHTML(
              `<img src="${resolvedUrl}" style="width:200px; height:120px; object-fit: cover; border-radius:4px; display:block;" />`,
            )
            markerInstance.setPopup(popup)

            el.addEventListener('mouseenter', () => markerInstance?.togglePopup())
            el.addEventListener('mouseleave', () => markerInstance?.togglePopup())
          }
        }

        markerInstance.addTo(map)
        markersMap.set(marker.id, markerInstance)
      }
      else {
        markerInstance.setLngLat([marker.coords.lon, marker.coords.lat])
      }
    })
  }

  const fitViewToMarkers = () => {
    if (markersMap.size === 0)
      return

    let minLon = Number.POSITIVE_INFINITY
    let minLat = Number.POSITIVE_INFINITY
    let maxLon = Number.NEGATIVE_INFINITY
    let maxLat = Number.NEGATIVE_INFINITY

    markersMap.forEach((marker) => {
      const lngLat = marker.getLngLat()
      if (lngLat.lng < minLon)
        minLon = lngLat.lng
      if (lngLat.lng > maxLon)
        maxLon = lngLat.lng
      if (lngLat.lat < minLat)
        minLat = lngLat.lat
      if (lngLat.lat > maxLat)
        maxLat = lngLat.lat
    })

    if (minLon !== Number.POSITIVE_INFINITY) {
      baseMap.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: { top: 50, right: 50, bottom: 50, left: 50 }, maxZoom: 15 },
      )
    }
  }

  const setSearchResult = (coords: { lat: number, lon: number }) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    if (!searchMarker) {
      const el = createMarkerElement({ color: '#FF5252', scale: 1.2 })
      searchMarker = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([coords.lon, coords.lat])
        .addTo(map)
    }
    else {
      searchMarker.setLngLat([coords.lon, coords.lat])
    }

    baseMap.flyTo(coords.lon, coords.lat, 14, 800)
  }

  const clearSearchResult = () => {
    if (searchMarker) {
      searchMarker.remove()
      searchMarker = null
    }
  }

  const initMap = async (
    container: HTMLElement,
    _popupEl?: HTMLElement | null,
    options: KitMapOptions = { center: [0, 0] },
  ): Promise<void> => {
    await baseMap.initMap({
      container,
      center: options.center,
      zoom: options.zoom ?? 12,
      pitch: options.pitch ?? 0,
      bearing: options.bearing ?? 0,
      style: options.initialStyle,
      showAttribution: false,
    })

    // При смене стиля восстанавливаем маркеры на холсте
    baseMap.onStyleLoad((map) => {
      markersMap.forEach(marker => marker.addTo(map))
      if (searchMarker) {
        searchMarker.addTo(map)
      }
    })
  }

  baseMap.mapInstance.value?.on('remove', () => {
    removeAllMarkers()
    clearSearchResult()
  })

  return {
    mapInstance: baseMap.mapInstance,
    isMapReady: baseMap.isMapReady,
    initMap,
    setStyle: baseMap.setStyle,
    setTileSource: (style: string | StyleSpecification) => baseMap.setStyle(style),
    zoomIn: baseMap.zoomIn,
    zoomOut: baseMap.zoomOut,
    flyTo: baseMap.flyTo,
    fitBounds: baseMap.fitBounds,
    updateMarkers,
    fitViewToMarkers,
    setSearchResult,
    clearSearchResult,
  }
}
