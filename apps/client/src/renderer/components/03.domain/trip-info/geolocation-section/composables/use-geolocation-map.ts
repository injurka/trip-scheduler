import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Coordinate, GeolocationMapOptions, MapPoint, MapRoute, TransportMode } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import * as maplibregl from 'maplibre-gl'
import { onUnmounted, readonly, ref } from 'vue'
import { useBaseMap } from '~/components/01.kit/kit-map'
import { useToast } from '~/shared/composables/use-toast'
import { getMapStyle } from '~/shared/lib/map-styles-sources'
import {
  createMarkerElement,
  isValidCoordinate,
  nominatimService,
  routingService,
} from '~/shared/services/geo'

const POINT_TYPE_COLORS: Record<string, string> = {
  poi: '#3498db',
  start: '#2ecc71',
  via: '#f1c40f',
  end: '#e74c3c',
  connect: '#95a5a6',
}

interface PointItem {
  marker: maplibregl.Marker
  popup?: maplibregl.Popup
  popupElement?: HTMLElement
  point: MapPoint
}

export type PointDragEndCallback = (pointId: string, coords: Coordinate) => void

export function useGeolocationMap() {
  const baseMap = useBaseMap()

  const pointsMap = new Map<string, PointItem>()
  const routesMap = new Map<string, MapRoute>()

  let searchResultMarker: maplibregl.Marker | null = null
  let currentLocationMarker: maplibregl.Marker | null = null
  let selectionMarker: maplibregl.Marker | null = null

  const activePointId = ref<string | null>(null)
  const hoveredPointId = ref<string | null>(null)
  const isDraggableAllowed = ref(true)
  const minZoomForComments = 13

  const dragEndListeners = new Set<PointDragEndCallback>()

  const onPointDragEnd = (cb: PointDragEndCallback) => {
    dragEndListeners.add(cb)
    return () => {
      dragEndListeners.delete(cb)
    }
  }

  const notifyPointDragEnd = (pointId: string, coords: Coordinate) => {
    dragEndListeners.forEach(cb => cb(pointId, coords))
  }

  const updateOverlayVisibilities = () => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const zoom = map.getZoom()
    const isZoomedIn = zoom >= minZoomForComments

    const container = map.getContainer()
    if (container) {
      container.classList.toggle('map-zoom-micro', zoom < 9)
      container.classList.toggle('map-zoom-far', zoom >= 9 && zoom < 11.5)
      container.classList.toggle('map-zoom-mid', zoom >= 11.5 && zoom < 14)
      container.classList.toggle('map-zoom-close', zoom >= 14)
    }

    pointsMap.forEach((item, id) => {
      const { popup, popupElement, point } = item
      if (!popup || !popupElement)
        return

      // Connect waypoints never show popups
      if (point.type === 'connect') {
        if (popup.isOpen())
          popup.remove()
        return
      }

      const isHovered = hoveredPointId.value === id
      const isActive = activePointId.value === id
      // Only standalone POIs with distinct comments are shown automatically at high zoom
      // Route points only show on hover or when active
      const isPoiWithComment = point.type === 'poi' && Boolean(point.comment && point.comment.trim() !== '' && point.comment.trim() !== point.address?.trim())
      const shouldShow = (isPoiWithComment && isZoomedIn) || isHovered || isActive

      if (shouldShow) {
        if (!popup.isOpen()) {
          popup.addTo(map)
        }
        popupElement.classList.remove('is-hidden-zoom')
        if (isActive) {
          popupElement.classList.add('is-active')
          popupElement.classList.remove('is-hovered')
        }
        else if (isHovered) {
          popupElement.classList.add('is-hovered')
          popupElement.classList.remove('is-active')
        }
        else {
          popupElement.classList.remove('is-active', 'is-hovered')
        }
      }
      else {
        if (popup.isOpen()) {
          popup.remove()
        }
      }
    })
  }

  const setActivePointId = (id: string | null) => {
    if (activePointId.value !== id) {
      activePointId.value = id
      updateOverlayVisibilities()
    }
  }

  const setTileSource = (sourceId: TileSourceId) => {
    baseMap.setStyle(getMapStyle(sourceId))
  }

  const renderRoute = (map: MapLibreMap, route: MapRoute) => {
    if (!route.geometry || route.geometry.length < 2)
      return

    const sourceId = `route-source-${route.id}`
    const shadowLayerId = `route-shadow-${route.id}`
    const casingLayerId = `route-casing-${route.id}`
    const lineLayerId = `route-line-${route.id}`
    const hitTargetLayerId = `route-hit-${route.id}`

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        id: route.id,
        color: route.color || '#4363D8',
        isDirect: Boolean(route.isDirect),
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

    // 1. Нижний размытый слой тени для эффекта объёма над картой
    map.addLayer({
      id: shadowLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#000000',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          4,
          12,
          7.5,
          16,
          11,
        ],
        'line-opacity': 0.16,
        'line-blur': 3,
        'line-offset': 1,
      },
    })

    // 2. Контрастная белая подложка (casing)
    map.addLayer({
      id: casingLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          3.5,
          12,
          6,
          16,
          8.5,
        ],
        'line-opacity': 0.95,
      },
    })

    // 3. Основная цветная линия маршрута
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': route.color || '#4363D8',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          2,
          12,
          3.8,
          16,
          5.5,
        ],
        ...(route.isDirect ? { 'line-dasharray': [2, 2] } : {}),
      },
    })

    // 4. Прозрачный расширенный интерактивный слой для плавного ховера
    map.addLayer({
      id: hitTargetLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#000000',
        'line-width': 16,
        'line-opacity': 0,
      },
    })

    const normalLineWidth: any = [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      2,
      12,
      3.8,
      16,
      5.5,
    ]
    const hoverLineWidth: any = [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      3,
      12,
      5.2,
      16,
      7.5,
    ]

    map.on('mouseenter', hitTargetLayerId, () => {
      map.getCanvas().style.cursor = 'pointer'
      if (map.getLayer(lineLayerId)) {
        map.setPaintProperty(lineLayerId, 'line-width', hoverLineWidth)
      }
    })

    map.on('mouseleave', hitTargetLayerId, () => {
      map.getCanvas().style.cursor = ''
      if (map.getLayer(lineLayerId)) {
        map.setPaintProperty(lineLayerId, 'line-width', normalLineWidth)
      }
    })
  }

  const addOrUpdateRoute = (route: MapRoute) => {
    routesMap.set(route.id, route)
    const map = baseMap.mapInstance.value
    if (!map || !baseMap.isMapReady.value)
      return
    renderRoute(map, route)
  }

  const removeRoute = (routeId: string) => {
    routesMap.delete(routeId)
    const map = baseMap.mapInstance.value
    if (!map)
      return

    const shadowLayerId = `route-shadow-${routeId}`
    const casingLayerId = `route-casing-${routeId}`
    const lineLayerId = `route-line-${routeId}`
    const hitTargetLayerId = `route-hit-${routeId}`
    const sourceId = `route-source-${routeId}`

    if (map.getLayer(hitTargetLayerId))
      map.removeLayer(hitTargetLayerId)
    if (map.getLayer(lineLayerId))
      map.removeLayer(lineLayerId)
    if (map.getLayer(casingLayerId))
      map.removeLayer(casingLayerId)
    if (map.getLayer(shadowLayerId))
      map.removeLayer(shadowLayerId)
    if (map.getSource(sourceId))
      map.removeSource(sourceId)
  }

  const clearRoutes = () => {
    const ids = Array.from(routesMap.keys())
    ids.forEach(removeRoute)
  }

  const addOrUpdatePoint = (point: MapPoint) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    if (!point || !point.coordinates)
      return

    let [lng, lat] = point.coordinates
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const temp = lat
      lat = lng
      lng = temp
      point.coordinates = [lng, lat]
    }

    if (!isValidCoordinate(point.coordinates)) {
      console.warn(`[useGeolocationMap] Пропущена точка с невалидными координатами:`, point)
      return
    }

    const color = point.style?.color || POINT_TYPE_COLORS[point.type] || '#3498db'
    const isConnect = point.type === 'connect'
    const hasDistinctComment = Boolean(point.comment && point.comment.trim() !== '' && point.comment.trim() !== point.address?.trim())
    const labelText = hasDistinctComment
      ? point.comment!
      : (point.type !== 'connect' && point.address && point.address.trim() !== '' ? point.address : '')

    const existing = pointsMap.get(point.id)

    if (existing) {
      if (existing.point.type !== point.type || existing.point.style?.color !== point.style?.color) {
        if (existing.popup?.isOpen()) {
          existing.popup.remove()
        }
        existing.marker.remove()
        pointsMap.delete(point.id)
      }
      else {
        existing.marker.setLngLat(point.coordinates)
        existing.marker.setDraggable(isDraggableAllowed.value)
        existing.point = point

        if (labelText && !isConnect) {
          if (!existing.popup) {
            const popupElement = document.createElement('div')
            popupElement.className = 'ol-popup-comment'
            popupElement.textContent = labelText

            popupElement.onclick = (e) => {
              e.stopPropagation()
              setActivePointId(point.id)
            }

            const popup = new maplibregl.Popup({
              offset: 32,
              closeButton: false,
              closeOnClick: false,
              closeOnMove: false,
              className: 'maplibre-point-comment-wrapper',
            }).setDOMContent(popupElement)

            existing.marker.setPopup(popup)
            existing.popup = popup
            existing.popupElement = popupElement
          }
          else if (existing.popupElement) {
            existing.popupElement.textContent = labelText
          }
        }
        else if (existing.popup) {
          existing.popup.remove()
          existing.popup = undefined
          existing.popupElement = undefined
        }

        updateOverlayVisibilities()
        return
      }
    }

    const el = createMarkerElement({
      color,
      scale: point.style?.scale || 1.1,
      opacity: point.style?.opacity ?? 1.0,
      zIndex: point.style?.zIndex ?? (isConnect ? 15 : 20),
      isConnect,
      pointType: point.type,
    })

    const marker = new maplibregl.Marker({
      element: el,
      anchor: isConnect ? 'center' : 'bottom',
      draggable: isDraggableAllowed.value,
    })
      .setLngLat(point.coordinates)
      .addTo(map)

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      const newCoords: Coordinate = [lngLat.lng, lngLat.lat]
      point.coordinates = newCoords
      notifyPointDragEnd(point.id, newCoords)
    })

    el.addEventListener('mouseenter', () => {
      hoveredPointId.value = point.id
      updateOverlayVisibilities()
    })

    el.addEventListener('mouseleave', () => {
      if (hoveredPointId.value === point.id) {
        hoveredPointId.value = null
        updateOverlayVisibilities()
      }
    })

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      setActivePointId(point.id)
    })

    let popup: maplibregl.Popup | undefined
    let popupElement: HTMLElement | undefined

    if (labelText && !isConnect) {
      popupElement = document.createElement('div')
      popupElement.className = 'ol-popup-comment'
      popupElement.textContent = labelText

      popupElement.onclick = (e) => {
        e.stopPropagation()
        setActivePointId(point.id)
      }

      popup = new maplibregl.Popup({
        offset: 32,
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        className: 'maplibre-point-comment-wrapper',
      }).setDOMContent(popupElement)

      marker.setPopup(popup)
    }

    pointsMap.set(point.id, {
      marker,
      popup,
      popupElement,
      point,
    })

    updateOverlayVisibilities()
  }

  const removePoint = (pointId: string) => {
    const item = pointsMap.get(pointId)
    if (item) {
      if (item.popup?.isOpen()) {
        item.popup.remove()
      }
      item.marker.remove()
      pointsMap.delete(pointId)
    }
  }

  const clearPoints = () => {
    pointsMap.forEach((item) => {
      if (item.popup?.isOpen()) {
        item.popup.remove()
      }
      item.marker.remove()
    })
    pointsMap.clear()
  }

  const setSelectionMarker = (coords: Coordinate | null) => {
    const map = baseMap.mapInstance.value
    if (!coords || !map) {
      if (selectionMarker) {
        selectionMarker.remove()
        selectionMarker = null
      }
      return
    }

    let [lng, lat] = coords
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const temp = lat
      lat = lng
      lng = temp
    }
    const safeCoords: [number, number] = [lng, lat]
    if (!isValidCoordinate(safeCoords))
      return

    if (!selectionMarker) {
      const el = document.createElement('div')
      el.className = 'maplibre-selection-marker'
      el.style.width = '18px'
      el.style.height = '18px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #E6194B'
      el.style.backgroundColor = 'rgba(230, 25, 75, 0.25)'
      el.style.pointerEvents = 'none'

      selectionMarker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat(safeCoords)
        .addTo(map)
    }
    else {
      selectionMarker.setLngLat(safeCoords)
    }
  }

  const clearSearchResult = () => {
    if (searchResultMarker) {
      searchResultMarker.remove()
      searchResultMarker = null
    }
  }

  const flyToLocation = (longitude: number, latitude: number, zoom = 14) => {
    baseMap.flyTo(longitude, latitude, zoom)
  }

  async function searchLocation(query: string): Promise<boolean> {
    clearSearchResult()
    if (!query.trim())
      return false

    const result = await nominatimService.searchSingle(query)
    if (!result)
      return false

    const { lon, lat, displayName } = result
    flyToLocation(lon, lat, 15)

    const map = baseMap.mapInstance.value
    if (map) {
      const el = createMarkerElement({ color: '#E74C3C', scale: 1.3 })
      const popup = new maplibregl.Popup({
        offset: 32,
        closeButton: true,
        closeOnClick: false,
      }).setText(displayName)

      searchResultMarker = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map)

      popup.addTo(map)
    }

    return true
  }

  const showCurrentLocation = () => {
    if (!navigator.geolocation) {
      useToast().error('Геолокация не поддерживается вашим браузером.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = baseMap.mapInstance.value
        if (!map)
          return

        const { longitude, latitude } = position.coords
        flyToLocation(longitude, latitude, 16)

        if (!currentLocationMarker) {
          const el = document.createElement('div')
          el.className = 'maplibre-current-location-marker'
          el.style.width = '16px'
          el.style.height = '16px'
          el.style.borderRadius = '50%'
          el.style.backgroundColor = '#3498db'
          el.style.border = '2.5px solid #ffffff'
          el.style.boxShadow = '0 0 0 4px rgba(52, 152, 219, 0.35)'

          currentLocationMarker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat([longitude, latitude])
            .addTo(map)
        }
        else {
          currentLocationMarker.setLngLat([longitude, latitude])
        }
      },
      () => {
        useToast().error('Не удалось определить местоположение.')
      },
      { enableHighAccuracy: true },
    )
  }

  const fetchRoute = async (
    waypoints: MapPoint[],
    transportMode: TransportMode = 'foot',
  ): Promise<(Partial<MapRoute> & { isDirect?: boolean }) | null> => {
    if (waypoints.length < 2)
      return null
    return routingService.calculateRoute(waypoints, transportMode)
  }

  const fetchAddress = async (coordinates: Coordinate) => {
    return nominatimService.reverse(coordinates)
  }

  const initMap = async (options: GeolocationMapOptions) => {
    if (!options.container) {
      console.error('[useGeolocationMap] Map container is required')
      return
    }

    const containerEl
      = typeof options.container === 'string'
        ? document.getElementById(options.container)!
        : options.container

    if (!containerEl)
      return

    isDraggableAllowed.value = options.interactive ?? true

    await baseMap.initMap({
      container: containerEl,
      center: options.center,
      zoom: options.zoom ?? 12,
      pitch: options.pitch ?? 0,
      maxPitch: 85,
      bearing: options.bearing ?? 0,
      interactive: options.interactive ?? true,
      showAttribution: true,
    })

    const map = baseMap.mapInstance.value
    if (map) {
      map.on('zoom', updateOverlayVisibilities)

      // При смене стиля восстанавливаем 3D рельеф, маршруты и маркеры
      baseMap.onStyleLoad((m) => {
        routesMap.forEach((route) => {
          renderRoute(m, route)
        })
        pointsMap.forEach(({ marker }) => {
          marker.addTo(m)
        })
        if (selectionMarker)
          selectionMarker.addTo(m)
        if (searchResultMarker)
          searchResultMarker.addTo(m)
        if (currentLocationMarker)
          currentLocationMarker.addTo(m)
        updateOverlayVisibilities()
      })
    }
  }

  // Эмуляция modifyInteraction для полной обратной совместимости API
  const modifyInteraction = {
    setActive: (active: boolean) => {
      isDraggableAllowed.value = active
      pointsMap.forEach(({ marker }) => {
        marker.setDraggable(active)
      })
    },
    on: (eventName: string, cb: any) => {
      if (eventName === 'modifyend') {
        return onPointDragEnd((pointId, coords) => {
          // Вызываем коллбэк в формате события
          cb({
            features: {
              getArray: () => [
                {
                  getId: () => pointId,
                  getGeometry: () => ({
                    getCoordinates: () => coords,
                  }),
                },
              ],
            },
          })
        })
      }
      return () => {}
    },
  }

  onUnmounted(() => {
    dragEndListeners.clear()
    clearPoints()
    clearRoutes()
    clearSearchResult()
    if (currentLocationMarker) {
      currentLocationMarker.remove()
      currentLocationMarker = null
    }
    if (selectionMarker) {
      selectionMarker.remove()
      selectionMarker = null
    }
  })

  const setInteractive = (interactive: boolean) => {
    baseMap.setInteractive(interactive)
    isDraggableAllowed.value = interactive
  }

  return {
    mapInstance: baseMap.mapInstance,
    isMapLoaded: baseMap.isMapReady,
    modifyInteraction,
    initMap,
    setInteractive,
    setTileSource,
    addOrUpdatePoint,
    removePoint,
    clearPoints,
    fetchAddress,
    flyToLocation,
    searchLocation,
    clearSearchResult,
    setSelectionMarker,
    fetchRoute,
    addOrUpdateRoute,
    removeRoute,
    clearRoutes,
    activePointId: readonly(activePointId),
    hoveredPointId: readonly(hoveredPointId),
    currentZoom: baseMap.currentZoom,
    setActivePointId,
    showCurrentLocation,
    onPointDragEnd,
  }
}
