import type { StyleSpecification } from 'maplibre-gl'
import type { KitMapOptions, KitMapRoute, MapMarker } from '../models/types'
import * as maplibregl from 'maplibre-gl'
import { resolveApiUrl } from '~/shared/lib/url'
import { createMarkerElement } from '~/shared/services/geo'
import { useBaseMap } from './use-base-map'

function getAvailableFont(map: maplibregl.Map): string[] {
  const layers = map.getStyle()?.layers || []
  for (const layer of layers) {
    if (layer.type === 'symbol' && layer.layout && 'text-font' in layer.layout) {
      const font = (layer.layout as Record<string, any>)['text-font']
      if (Array.isArray(font) && font.length) {
        return font
      }
    }
  }
  return ['Open Sans Regular', 'Arial Unicode MS Regular']
}

function getLabelColors(): { color: string, haloColor: string } {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return { color: '#f3f4f6', haloColor: '#18181b' }
  }
  return { color: '#1f2937', haloColor: '#ffffff' }
}

export function useKitMap() {
  const baseMap = useBaseMap()

  const markersMap = new Map<string, maplibregl.Marker>()
  const routesMap = new Map<string, KitMapRoute>()
  let searchMarker: maplibregl.Marker | null = null

  const circleSourceId = 'kit-circle-markers-src'
  const circleLayerId = 'kit-circle-markers-layer'
  const circleLabelsLayerId = 'kit-circle-markers-labels'
  let circleHoverPopup: maplibregl.Popup | null = null
  let circleMarkersData: MapMarker[] = []
  let isHoverListenersAttached = false

  const clearCircleMarkers = (map: maplibregl.Map | null | undefined) => {
    circleMarkersData = []
    if (circleHoverPopup) {
      circleHoverPopup.remove()
      circleHoverPopup = null
    }
    if (!map)
      return

    if (map.getLayer(circleLabelsLayerId))
      map.removeLayer(circleLabelsLayerId)
    if (map.getLayer(circleLayerId))
      map.removeLayer(circleLayerId)
    if (map.getSource(circleSourceId))
      map.removeSource(circleSourceId)
  }

  const renderCircleMarkers = (map: maplibregl.Map, circleMarkers: MapMarker[]) => {
    circleMarkersData = circleMarkers

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: circleMarkers.map(marker => ({
        type: 'Feature',
        properties: {
          id: marker.id,
          title: marker.title || '',
          color: marker.color || '#3399CC',
          showLabel: Boolean(marker.showLabel),
        },
        geometry: {
          type: 'Point',
          coordinates: [marker.coords.lon, marker.coords.lat],
        },
      })),
    }

    const existingSource = map.getSource(circleSourceId) as maplibregl.GeoJSONSource | undefined
    if (existingSource) {
      existingSource.setData(geojson)
      if (map.getLayer(circleLabelsLayerId)) {
        const hasAnyLabelVisible = circleMarkers.some(m => m.showLabel)
        map.setLayoutProperty(circleLabelsLayerId, 'visibility', hasAnyLabelVisible ? 'visible' : 'none')
      }
      return
    }

    if (!circleMarkers.length)
      return

    map.addSource(circleSourceId, {
      type: 'geojson',
      data: geojson,
    })

    // 1. Точки-кружки на холсте WebGL (рендеринг на видеокарте вместо десятков/сотен DOM-элементов)
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: circleSourceId,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          3,
          11,
          4.5,
          14,
          6,
          17,
          8,
        ],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })

    // 2. Подписи станций при включенном режиме "Названия станций"
    const hasGlyphs = Boolean(map.getStyle()?.glyphs)
    if (hasGlyphs) {
      const fontStack = getAvailableFont(map)
      const labelColors = getLabelColors()
      const hasAnyLabelVisible = circleMarkers.some(m => m.showLabel)

      map.addLayer({
        id: circleLabelsLayerId,
        type: 'symbol',
        source: circleSourceId,
        layout: {
          'text-field': ['get', 'title'],
          'text-font': fontStack,
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            10,
            12,
            11,
            15,
            12,
          ],
          'text-offset': [0.75, 0],
          'text-anchor': 'left',
          'text-optional': true,
          'visibility': hasAnyLabelVisible ? 'visible' : 'none',
        },
        paint: {
          'text-color': labelColors.color,
          'text-halo-color': labelColors.haloColor,
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
        },
      })
    }

    if (!isHoverListenersAttached) {
      map.on('mouseenter', circleLayerId, (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = e.features?.[0]
        if (feature && feature.geometry.type === 'Point') {
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          const title = feature.properties?.title
          if (title) {
            if (!circleHoverPopup) {
              circleHoverPopup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 12,
                className: 'maplibre-station-hover-wrapper',
              })
            }
            circleHoverPopup
              .setLngLat(coords)
              .setHTML(`<div class="station-label-popup">${title}</div>`)
              .addTo(map)
          }
        }
      })

      map.on('mouseleave', circleLayerId, () => {
        map.getCanvas().style.cursor = ''
        circleHoverPopup?.remove()
      })

      isHoverListenersAttached = true
    }
  }

  const removeAllMarkers = () => {
    markersMap.forEach(marker => marker.remove())
    markersMap.clear()
    clearCircleMarkers(baseMap.mapInstance.value)
  }

  const updateMarkers = (markers: MapMarker[]) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const circleMarkers = markers.filter(m => m.shape === 'circle')
    const domMarkers = markers.filter(m => m.shape !== 'circle')

    renderCircleMarkers(map, circleMarkers)

    const newMarkerIds = new Set(domMarkers.map(m => m.id))

    // Удаляем маркеры, которых больше нет в списке
    markersMap.forEach((marker, id) => {
      if (!newMarkerIds.has(id)) {
        marker.remove()
        markersMap.delete(id)
      }
    })

    if (!domMarkers.length)
      return

    domMarkers.forEach((marker) => {
      let markerInstance = markersMap.get(marker.id)

      if (!markerInstance) {
        const isConnect = marker.pointType === 'connect'
        const el = createMarkerElement({
          color: marker.color || '#3399CC',
          scale: marker.scale || 1.1,
          pointType: marker.pointType || 'poi',
          shape: marker.shape,
          isConnect,
          label: marker.shape === 'circle' ? marker.title : marker.label,
        })

        markerInstance = new maplibregl.Marker({
          element: el,
          anchor: isConnect || marker.shape === 'circle' ? 'center' : 'bottom',
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
        else {
          const hasDistinctComment = Boolean(marker.comment && marker.comment.trim() !== '' && marker.comment.trim() !== marker.address?.trim())
          const popupText = hasDistinctComment
            ? marker.comment!
            : (marker.pointType !== 'connect' && marker.address && marker.address.trim() !== '' ? marker.address : (marker.title || ''))

          if (popupText && marker.pointType !== 'connect' && marker.shape !== 'circle') {
            const popupElement = document.createElement('div')
            popupElement.className = 'ol-popup-comment'
            popupElement.textContent = popupText

            const popup = new maplibregl.Popup({
              offset: 32,
              closeButton: false,
              closeOnClick: false,
              closeOnMove: false,
              className: 'maplibre-point-comment-wrapper',
            }).setDOMContent(popupElement)

            markerInstance.setPopup(popup)
            if (hasDistinctComment) {
              popup.addTo(map)
            }
            else {
              el.addEventListener('mouseenter', () => {
                if (!popup.isOpen())
                  popup.addTo(map)
              })
              el.addEventListener('mouseleave', () => {
                if (popup.isOpen())
                  popup.remove()
              })
            }
          }
        }

        markerInstance.addTo(map)
        markersMap.set(marker.id, markerInstance)
      }
      else {
        markerInstance.setLngLat([marker.coords.lon, marker.coords.lat])
      }
      markerInstance.getElement().classList.toggle('show-label', Boolean(marker.showLabel))
    })
  }

  const renderRoute = (map: maplibregl.Map, route: KitMapRoute) => {
    if (!route.geometry || route.geometry.length < 2)
      return

    const sourceId = `kit-route-src-${route.id}`
    const shadowLayerId = `kit-route-shadow-${route.id}`
    const casingLayerId = `kit-route-casing-${route.id}`
    const lineLayerId = `kit-route-line-${route.id}`

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        id: route.id,
        color: route.color || '#4363D8',
      },
      geometry: {
        type: 'LineString',
        coordinates: route.geometry,
      },
    }

    const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
    if (existingSource) {
      existingSource.setData(geojson)
      if (map.getLayer(lineLayerId)) {
        map.setPaintProperty(lineLayerId, 'line-color', route.color || '#4363D8')
        map.setPaintProperty(
          lineLayerId,
          'line-dasharray',
          route.isDirect ? [2, 2] : undefined,
        )
      }
      return
    }

    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    })

    // 1. Слой тени (shadow)
    map.addLayer({
      id: shadowLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7.5, 16, 11],
        'line-opacity': 0.16,
        'line-blur': 3,
        'line-offset': 1,
      },
    })

    // 2. Белая подложка (casing)
    map.addLayer({
      id: casingLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 12, 6, 16, 8.5],
        'line-opacity': 0.95,
      },
    })

    // 3. Основная линия
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.color || '#4363D8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 3.8, 16, 5.5],
        ...(route.isDirect ? { 'line-dasharray': [2, 2] } : {}),
      },
    })
  }

  const removeRoute = (routeId: string) => {
    routesMap.delete(routeId)
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const sourceId = `kit-route-src-${routeId}`
    if (map.getLayer(`kit-route-line-${routeId}`))
      map.removeLayer(`kit-route-line-${routeId}`)
    if (map.getLayer(`kit-route-casing-${routeId}`))
      map.removeLayer(`kit-route-casing-${routeId}`)
    if (map.getLayer(`kit-route-shadow-${routeId}`))
      map.removeLayer(`kit-route-shadow-${routeId}`)
    if (map.getSource(sourceId))
      map.removeSource(sourceId)
  }

  const clearRoutes = () => {
    Array.from(routesMap.keys()).forEach(removeRoute)
  }

  const updateRoutes = (routes: KitMapRoute[]) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const newIds = new Set(routes.map(r => r.id))
    routesMap.forEach((_, id) => {
      if (!newIds.has(id))
        removeRoute(id)
    })

    routes.forEach((route) => {
      routesMap.set(route.id, route)
      if (route.isVisible !== false) {
        renderRoute(map, route)
      }
      else {
        removeRoute(route.id)
      }
    })
  }

  const fitViewToMarkers = () => {
    const map = baseMap.mapInstance.value
    if (!map)
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

    circleMarkersData.forEach((marker) => {
      const lon = marker.coords.lon
      const lat = marker.coords.lat
      if (lon < minLon)
        minLon = lon
      if (lon > maxLon)
        maxLon = lon
      if (lat < minLat)
        minLat = lat
      if (lat > maxLat)
        maxLat = lat
    })

    routesMap.forEach((route) => {
      if (route.geometry) {
        route.geometry.forEach(([lon, lat]) => {
          if (lon < minLon)
            minLon = lon
          if (lon > maxLon)
            maxLon = lon
          if (lat < minLat)
            minLat = lat
          if (lat > maxLat)
            maxLat = lat
        })
      }
    })

    if (minLon !== Number.POSITIVE_INFINITY && maxLon !== Number.NEGATIVE_INFINITY) {
      baseMap.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: { top: 60, right: 60, bottom: 60, left: 60 }, maxZoom: 14.8 },
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

    // При смене стиля восстанавливаем маркеры и маршруты на холсте
    baseMap.onStyleLoad((map) => {
      routesMap.forEach(route => renderRoute(map, route))
      markersMap.forEach(marker => marker.addTo(map))
      if (searchMarker) {
        searchMarker.addTo(map)
      }
      isHoverListenersAttached = false
      if (circleMarkersData.length > 0) {
        renderCircleMarkers(map, circleMarkersData)
      }
    })
  }

  baseMap.mapInstance.value?.on('remove', () => {
    removeAllMarkers()
    clearRoutes()
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
    updateRoutes,
    fitViewToMarkers,
    setSearchResult,
    clearSearchResult,
  }
}
