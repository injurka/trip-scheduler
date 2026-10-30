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

interface CoordinateBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

const STATIC_POINTS_SOURCE_ID = 'static-map-points'
const STATIC_ROUTES_SOURCE_ID = 'static-map-routes'
const STATIC_ROUTE_CASING_LAYER_ID = 'static-map-routes-casing'
const STATIC_ROUTE_LINE_LAYER_ID = 'static-map-routes-line'
const STATIC_ROUTE_HIT_LAYER_ID = 'static-map-routes-hit'
const STATIC_POINTS_LAYER_ID = 'static-map-points-layer'

function includeCoordinate(bounds: CoordinateBounds, coordinate?: Coordinate | null) {
  if (!coordinate || !isValidCoordinate(coordinate))
    return

  const [longitude, latitude] = coordinate
  bounds.minLng = Math.min(bounds.minLng, longitude)
  bounds.maxLng = Math.max(bounds.maxLng, longitude)
  bounds.minLat = Math.min(bounds.minLat, latitude)
  bounds.maxLat = Math.max(bounds.maxLat, latitude)
}

function includeRouteCoordinates(bounds: CoordinateBounds, route: MapRoute) {
  if (route.geometry?.length) {
    route.geometry.forEach(coordinate => includeCoordinate(bounds, coordinate))

    return
  }

  route.points.forEach(point => includeCoordinate(bounds, point.coordinates))
}

function getCoordinateBounds(points: MapPoint[], routes: MapRoute[]): CoordinateBounds | null {
  const bounds: CoordinateBounds = {
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  }

  points.forEach(point => includeCoordinate(bounds, point.coordinates))
  routes.forEach(route => includeRouteCoordinates(bounds, route))

  return bounds.minLng === Number.POSITIVE_INFINITY || bounds.minLat === Number.POSITIVE_INFINITY
    ? null
    : bounds
}

function isSingleCoordinate(bounds: CoordinateBounds): boolean {
  return bounds.minLng === bounds.maxLng && bounds.minLat === bounds.maxLat
}

function getBoundsPadding(padding?: number | { top: number, right: number, bottom: number, left: number }) {
  if (typeof padding === 'number')
    return { top: padding, right: padding, bottom: padding, left: padding }

  return padding ?? { top: 60, right: 60, bottom: 60, left: 60 }
}

function getPaddedBounds(bounds: CoordinateBounds): [Coordinate, Coordinate] {
  const longitudeSpan = bounds.maxLng - bounds.minLng
  const latitudeSpan = bounds.maxLat - bounds.minLat
  const marginRatio = 0.10

  return [
    [bounds.minLng - longitudeSpan * marginRatio, Math.max(-85, bounds.minLat - latitudeSpan * marginRatio)],
    [bounds.maxLng + longitudeSpan * marginRatio, Math.min(85, bounds.maxLat + latitudeSpan * marginRatio)],
  ]
}

function getPointMarkerColor(point: MapPoint): string {
  return point.style?.color || POINT_TYPE_COLORS[point.type] || '#3498db'
}

function getPointMarkerScale(point: MapPoint): number {
  return point.style?.scale || 1.1
}

function getPointMarkerOpacity(point: MapPoint): number {
  return point.style?.opacity ?? 1.0
}

function getPointMarkerZIndex(point: MapPoint, isConnect: boolean): number {
  return point.style?.zIndex ?? (isConnect ? 15 : 20)
}

function getMapFitOptions(options?: { padding?: number | { top: number, right: number, bottom: number, left: number }, maxZoom?: number, duration?: number }) {
  return {
    padding: getBoundsPadding(options?.padding),
    maxZoom: options?.maxZoom ?? 14.8,
    duration: options?.duration !== undefined ? options.duration : 400,
  }
}

export type PointDragEndCallback = (pointId: string, coords: Coordinate) => void

export function useGeolocationMap() {
  const baseMap = useBaseMap()

  const pointsMap = new Map<string, PointItem>()
  const routesMap = new Map<string, MapRoute>()

  let searchResultMarker: maplibregl.Marker | null = null
  let currentLocationMarker: maplibregl.Marker | null = null
  let selectionMarker: maplibregl.Marker | null = null
  let staticData: { points: MapPoint[], routes: MapRoute[] } | null = null

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

  function updatePointPopupVisibility(
    map: MapLibreMap,
    item: PointItem,
    id: string,
    isZoomedIn: boolean,
  ) {
    const { popup, popupElement, point } = item

    if (!popup || !popupElement)
      return

    if (point.type === 'connect') {
      if (popup.isOpen())
        popup.remove()

      return
    }

    const isHovered = hoveredPointId.value === id
    const isActive = activePointId.value === id
    const shouldShow = shouldShowPointPopup(
      point,
      isZoomedIn,
      isHovered,
      isActive,
    )

    if (!shouldShow) {
      if (popup.isOpen())
        popup.remove()

      return
    }

    if (!popup.isOpen())
      popup.addTo(map)

    updatePointPopupClasses(popupElement, isActive, isHovered)
  }

  function shouldShowPointPopup(
    point: MapPoint,
    isZoomedIn: boolean,
    isHovered: boolean,
    isActive: boolean,
  ): boolean {
    const hasDistinctComment = Boolean(point.comment && point.comment.trim() !== '' && point.comment.trim() !== point.address?.trim())
    const isPoiWithComment = point.type === 'poi' && hasDistinctComment

    return (isPoiWithComment && isZoomedIn) || isHovered || isActive
  }

  function updatePointPopupClasses(element: HTMLElement, isActive: boolean, isHovered: boolean) {
    element.classList.remove('is-hidden-zoom')

    if (isActive) {
      element.classList.add('is-active')
      element.classList.remove('is-hovered')
    }
    else if (isHovered) {
      element.classList.add('is-hovered')
      element.classList.remove('is-active')
    }
    else {
      element.classList.remove('is-active', 'is-hovered')
    }
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

    pointsMap.forEach((item, id) => updatePointPopupVisibility(
      map,
      item,
      id,
      isZoomedIn,
    ))
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

  const getStaticRouteData = (routes: MapRoute[]): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
    type: 'FeatureCollection',
    features: routes.flatMap((route) => {
      const geometry = (route.geometry?.length
        ? route.geometry
        : route.points.map(point => point.coordinates)
      ).filter(isValidCoordinate)

      if (geometry.length < 2)
        return []

      return [{
        type: 'Feature' as const,
        properties: {
          id: route.id,
          color: route.color || '#4363D8',
          isDirect: Boolean(route.isDirect) || !route.geometry?.length,
        },
        geometry: { type: 'LineString' as const, coordinates: geometry },
      }]
    }),
  })

  const getStaticPointData = (points: MapPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
    type: 'FeatureCollection',
    features: points.flatMap((point) => {
      if (!isValidCoordinate(point.coordinates))
        return []

      return [{
        type: 'Feature' as const,
        properties: {
          id: point.id,
          color: point.style?.color || POINT_TYPE_COLORS[point.type] || '#3498db',
          type: point.type,
        },
        geometry: { type: 'Point' as const, coordinates: point.coordinates },
      }]
    }),
  })

  const renderStaticData = (map: MapLibreMap) => {
    if (!staticData)
      return

    const routes = getStaticRouteData(staticData.routes)
    const points = getStaticPointData(staticData.points)
    const routeSource = map.getSource(STATIC_ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    const pointSource = map.getSource(STATIC_POINTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

    if (routeSource) {
      routeSource.setData(routes)
    }
    else {
      map.addSource(STATIC_ROUTES_SOURCE_ID, { type: 'geojson', data: routes })
      map.addLayer({
        id: STATIC_ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: STATIC_ROUTES_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 12, 6, 16, 8.5], 'line-opacity': 0.95 },
      })
      map.addLayer({
        id: STATIC_ROUTE_LINE_LAYER_ID,
        type: 'line',
        source: STATIC_ROUTES_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 3.8, 16, 5.5],
          'line-dasharray': ['case', ['get', 'isDirect'], ['literal', [2, 2]], ['literal', [1, 0]]],
        },
      })
      map.addLayer({
        id: STATIC_ROUTE_HIT_LAYER_ID,
        type: 'line',
        source: STATIC_ROUTES_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#000000', 'line-width': 18, 'line-opacity': 0 },
      })
    }

    if (pointSource) {
      pointSource.setData(points)
    }
    else {
      map.addSource(STATIC_POINTS_SOURCE_ID, { type: 'geojson', data: points })
      map.addLayer({
        id: STATIC_POINTS_LAYER_ID,
        type: 'circle',
        source: STATIC_POINTS_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['==', ['get', 'type'], 'connect'], 4, 7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
    }
  }

  const setStaticMapData = (points: MapPoint[], routes: MapRoute[]) => {
    staticData = { points, routes }
    const map = baseMap.mapInstance.value

    if (map && baseMap.isMapReady.value)
      renderStaticData(map)
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
        map.setPaintProperty(lineLayerId, 'line-dasharray', route.isDirect ? [2, 2] : undefined)
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

    if (!map || !point?.coordinates)
      return

    if (!normalizePointCoordinates(point))
      return

    const existing = pointsMap.get(point.id)

    if (existing && updateExistingPoint(existing, point))
      return

    createPointMarker(map, point, getPointLabel(point))
  }

  function normalizePointCoordinates(point: MapPoint): boolean {
    const [lng, lat] = point.coordinates

    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90)
      point.coordinates = [lat, lng]

    if (isValidCoordinate(point.coordinates))
      return true

    console.warn('[useGeolocationMap] Пропущена точка с невалидными координатами:', point)

    return false
  }

  function getPointLabel(point: MapPoint): string {
    const hasDistinctComment = Boolean(point.comment && point.comment.trim() !== '' && point.comment.trim() !== point.address?.trim())

    if (hasDistinctComment)
      return point.comment!

    return point.type !== 'connect' && point.address?.trim() ? point.address : ''
  }

  function hasPointStyleChanged(existing: PointItem, point: MapPoint): boolean {
    const existingStyle = existing.point.style || {}
    const nextStyle = point.style || {}
    const keys = ['color', 'opacity', 'scale', 'zIndex'] as const

    return existing.point.type !== point.type
      || keys.some(key => existingStyle[key] !== nextStyle[key])
  }

  function updateExistingPoint(existing: PointItem, point: MapPoint): boolean {
    if (hasPointStyleChanged(existing, point)) {
      removePointItem(existing, point.id)

      return false
    }

    existing.marker.setLngLat(point.coordinates)
    existing.marker.setDraggable(isDraggableAllowed.value)
    existing.point = point
    syncExistingPointPopup(existing, point, getPointLabel(point))
    updateOverlayVisibilities()

    return true
  }

  function removePointItem(item: PointItem, pointId: string) {
    if (item.popup?.isOpen())
      item.popup.remove()

    item.marker.remove()
    pointsMap.delete(pointId)
  }

  function syncExistingPointPopup(item: PointItem, point: MapPoint, labelText: string) {
    if (labelText && point.type !== 'connect') {
      if (!item.popup)
        createPointPopup(item, point, labelText)
      else if (item.popupElement)
        item.popupElement.textContent = labelText

      return
    }

    if (item.popup)
      item.popup.remove()

    item.popup = undefined
    item.popupElement = undefined
  }

  function createPointPopup(item: PointItem, point: MapPoint, labelText: string) {
    const popupElement = createPointPopupElement(point.id, labelText)
    const popup = new maplibregl.Popup({
      offset: 32,
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      className: 'maplibre-point-comment-wrapper',
    }).setDOMContent(popupElement)

    item.marker.setPopup(popup)
    item.popup = popup
    item.popupElement = popupElement
  }

  function createPointPopupElement(pointId: string, labelText: string): HTMLElement {
    const popupElement = document.createElement('div')
    popupElement.className = 'ol-popup-comment'
    popupElement.textContent = labelText
    popupElement.onclick = (event) => {
      event.stopPropagation()
      setActivePointId(pointId)
    }

    return popupElement
  }

  function createPointMarker(map: MapLibreMap, point: MapPoint, labelText: string) {
    const isConnect = point.type === 'connect'
    const element = createMarkerElement({
      color: getPointMarkerColor(point),
      scale: getPointMarkerScale(point),
      opacity: getPointMarkerOpacity(point),
      zIndex: getPointMarkerZIndex(point, isConnect),
      isConnect,
      pointType: point.type,
    })
    const marker = new maplibregl.Marker({
      element,
      anchor: isConnect ? 'center' : 'bottom',
      draggable: isDraggableAllowed.value,
    }).setLngLat(point.coordinates).addTo(map)

    attachPointMarkerEvents(marker, element, point)
    const item: PointItem = { marker, point }

    if (labelText && !isConnect)
      createPointPopup(item, point, labelText)

    pointsMap.set(point.id, item)
    updateOverlayVisibilities()
  }

  function attachPointMarkerEvents(marker: maplibregl.Marker, element: HTMLElement, point: MapPoint) {
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      const coordinates: Coordinate = [lngLat.lng, lngLat.lat]
      point.coordinates = coordinates
      notifyPointDragEnd(point.id, coordinates)
    })

    element.addEventListener('mouseenter', () => {
      hoveredPointId.value = point.id
      updateOverlayVisibilities()
    })
    element.addEventListener('mouseleave', () => {
      if (hoveredPointId.value === point.id) {
        hoveredPointId.value = null
        updateOverlayVisibilities()
      }
    })
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      setActivePointId(point.id)
    })
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

  const flyToLocation = (longitude: number, latitude: number, zoom = 13.5) => {
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
    flyToLocation(lon, lat, 14)

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

    navigator.geolocation.getCurrentPosition((position) => {
      const map = baseMap.mapInstance.value

      if (!map)
        return

      const { longitude, latitude } = position.coords
      flyToLocation(longitude, latitude, 14)

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
    }, () => {
      useToast().error('Не удалось определить местоположение.')
    }, { enableHighAccuracy: true })
  }

  const fetchRoute = async (waypoints: MapPoint[], transportMode: TransportMode = 'foot'): Promise<(Partial<MapRoute> & { isDirect?: boolean }) | null> => {
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
      bearing: options.bearing ?? 0,
      interactive: options.interactive ?? true,
      showAttribution: true,
      bounds: options.bounds,
      fitBoundsOptions: options.fitBoundsOptions,
    })

    const map = baseMap.mapInstance.value

    if (map) {
      map.on('zoom', updateOverlayVisibilities)

      // При смене стиля восстанавливаем 3D рельеф, маршруты и маркеры
      baseMap.onStyleLoad((m) => {
        renderStaticData(m)
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

      return () => { }
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

    staticData = null
  })

  const setInteractive = (interactive: boolean) => {
    baseMap.setInteractive(interactive)
    isDraggableAllowed.value = interactive
  }

  const fitToContent = (customPoints?: MapPoint[], customRoutes?: MapRoute[], options?: {
    padding?: number | { top: number, right: number, bottom: number, left: number }
    maxZoom?: number
    duration?: number
  }): boolean => {
    const pts = customPoints ?? Array.from(pointsMap.values()).map(item => item.point)
    const rts = customRoutes ?? Array.from(routesMap.values())

    const bounds = getCoordinateBounds(pts, rts)

    if (!bounds)
      return false

    const map = baseMap.mapInstance.value

    if (!map)
      return false

    if (isSingleCoordinate(bounds)) {
      return flyToSingleCoordinate(map, bounds, options)
    }

    const paddedBounds = getPaddedBounds(bounds)

    baseMap.fitBounds(paddedBounds, getMapFitOptions(options))

    return true
  }

  function flyToSingleCoordinate(map: MapLibreMap, bounds: CoordinateBounds, options?: { maxZoom?: number, duration?: number }): boolean {
    map.flyTo({
      center: [bounds.minLng, bounds.minLat],
      zoom: Math.min(options?.maxZoom ?? 13.5, 13.5),
      duration: options?.duration !== undefined ? options.duration : 400,
    })

    return true
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
    setStaticMapData,
    activePointId: readonly(activePointId),
    hoveredPointId: readonly(hoveredPointId),
    currentZoom: baseMap.currentZoom,
    setActivePointId,
    showCurrentLocation,
    onPointDragEnd,
    fitBounds: baseMap.fitBounds,
    fitToContent,
  }
}
