import type { Coordinate, GeolocationMapOptions, MapPoint, MapRoute, TransportMode } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import { Feature, Overlay } from 'ol'
import { LineString, Point } from 'ol/geom'
import { Modify } from 'ol/interaction'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { onUnmounted, readonly, ref } from 'vue'
import { useBaseMap } from '~/components/01.kit/kit-map'
import { useToast } from '~/shared/composables/use-toast'
import { checkMapTilerAvailability, TILE_SOURCES } from '~/shared/lib/map-styles-sources'
import {
  createMarkerStyle,
  createRouteStyles,
  nominatimService,
  routingService,
  toMapCoord,
} from '~/shared/services/geo'

const SEARCH_RESULT_OVERLAY_ID = 'search-result-overlay'

const POINT_TYPE_COLORS: Record<string, string> = {
  poi: '#3498db',
  start: '#2ecc71',
  via: '#f1c40f',
  end: '#e74c3c',
  connect: '#95a5a6',
}

export function useGeolocationMap() {
  const baseMap = useBaseMap()

  const pointSource = new VectorSource()
  const routeSource = new VectorSource()
  const searchResultSource = new VectorSource()
  const currentLocationSource = new VectorSource()
  const selectionSource = new VectorSource()

  const pointLayer = new VectorLayer({ source: pointSource, zIndex: 10 })
  const routeLayer = new VectorLayer({ source: routeSource, zIndex: 5 })
  const searchResultLayer = new VectorLayer({ source: searchResultSource, zIndex: 11 })
  const currentLocationLayer = new VectorLayer({ source: currentLocationSource, zIndex: 12 })
  const selectionLayer = new VectorLayer({ source: selectionSource, zIndex: 9 })

  const modifyInteraction = new Modify({ source: pointSource })

  let cleanUpRmbListeners: (() => void) | null = null

  const activePointId = ref<string | null>(null)
  const hoveredPointId = ref<string | null>(null)
  const minZoomForComments = 13

  interface PointOverlayItem {
    overlay: Overlay
    element: HTMLElement
    baseOpacity?: number
    baseZIndex?: number
  }
  const pointOverlays = new Map<string, PointOverlayItem>()

  const updateOverlayVisibilities = () => {
    const isZoomedIn = (baseMap.currentZoom.value ?? 0) >= minZoomForComments

    pointOverlays.forEach((item, id) => {
      const el = item.element
      if (!el)
        return

      const isHovered = hoveredPointId.value === id
      const isActive = activePointId.value === id
      const shouldShow = isZoomedIn || isHovered || isActive

      if (shouldShow) {
        el.classList.remove('is-hidden-zoom')
        if (isActive) {
          el.classList.add('is-active')
          el.classList.remove('is-hovered')
          if (el.parentElement) {
            el.parentElement.style.zIndex = '100'
          }
        }
        else if (isHovered) {
          el.classList.add('is-hovered')
          el.classList.remove('is-active')
          if (el.parentElement) {
            el.parentElement.style.zIndex = '99'
          }
        }
        else {
          el.classList.remove('is-active', 'is-hovered')
          if (el.parentElement) {
            el.parentElement.style.zIndex = item.baseZIndex !== undefined ? String(item.baseZIndex) : ''
          }
        }
      }
      else {
        el.classList.add('is-hidden-zoom')
        el.classList.remove('is-active', 'is-hovered')
        if (el.parentElement) {
          el.parentElement.style.zIndex = item.baseZIndex !== undefined ? String(item.baseZIndex) : ''
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

  // Сдвиг карты строго по горизонтали при зажатой ПКМ
  const setupRmbHorizontalPan = (containerEl: HTMLElement) => {
    let isRmbDragging = false
    let startClientX = 0
    let initialCenterX = 0

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault()
        isRmbDragging = true
        startClientX = e.clientX

        const view = baseMap.mapInstance.value?.getView()
        const center = view?.getCenter()
        if (center) {
          initialCenterX = center[0]
        }
        containerEl.style.cursor = 'ew-resize'
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isRmbDragging || !baseMap.mapInstance.value)
        return

      const view = baseMap.mapInstance.value.getView()
      const center = view.getCenter()
      const resolution = view.getResolution() || 1
      if (!center)
        return

      const deltaX = e.clientX - startClientX
      const targetX = initialCenterX - deltaX * resolution
      view.setCenter([targetX, center[1]])
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2 || isRmbDragging) {
        isRmbDragging = false
        containerEl.style.cursor = ''
      }
    }

    containerEl.addEventListener('contextmenu', onContextMenu)
    containerEl.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    cleanUpRmbListeners = () => {
      containerEl.removeEventListener('contextmenu', onContextMenu)
      containerEl.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
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

    if (!containerEl) {
      return
    }

    const isMapTilerWorking = await checkMapTilerAvailability()
    const initialSource = isMapTilerWorking
      ? TILE_SOURCES.maptilerOutdoor.source
      : TILE_SOURCES.osm.source

    await baseMap.initMap({
      container: containerEl,
      center: options.center,
      zoom: options.zoom || 12,
      initialSource,
      extraLayers: [routeLayer, selectionLayer, pointLayer, searchResultLayer, currentLocationLayer],
      extraInteractions: [modifyInteraction],
      showAttribution: true,
    })

    modifyInteraction.setActive(options.interactive ?? true)
    setupRmbHorizontalPan(containerEl)

    const map = baseMap.mapInstance.value
    if (map) {
      map.getView().on('change:resolution', () => {
        updateOverlayVisibilities()
      })

      map.on('pointermove', (evt) => {
        if (evt.dragging || !baseMap.mapInstance.value)
          return

        const feature = baseMap.mapInstance.value.forEachFeatureAtPixel(
          evt.pixel,
          f => f,
          {
            hitTolerance: 6,
            layerFilter: layer => layer === pointLayer || layer === searchResultLayer,
          },
        )

        const targetElement = baseMap.mapInstance.value.getTargetElement()
        if (feature) {
          const id = feature.getId() as string | undefined
          if (id && id !== hoveredPointId.value) {
            hoveredPointId.value = id
            updateOverlayVisibilities()
          }
          if (targetElement && !targetElement.classList.contains('cursor-crosshair') && !targetElement.classList.contains('cursor-move')) {
            targetElement.style.cursor = 'pointer'
          }
        }
        else {
          if (hoveredPointId.value !== null) {
            hoveredPointId.value = null
            updateOverlayVisibilities()
          }
          if (targetElement && !targetElement.classList.contains('cursor-crosshair') && !targetElement.classList.contains('cursor-move')) {
            targetElement.style.cursor = ''
          }
        }
      })
    }
  }

  const setTileSource = (sourceId: TileSourceId) => {
    if (TILE_SOURCES[sourceId]) {
      baseMap.setTileSource(TILE_SOURCES[sourceId].source)
    }
  }

  function getPointStyle(point: MapPoint): Style {
    const color = point.style?.color || POINT_TYPE_COLORS[point.type] || '#3498db'
    return createMarkerStyle({
      color,
      scale: point.style?.scale || 1.5,
      opacity: point.style?.opacity !== undefined ? point.style.opacity : 1.0,
      zIndex: point.style?.zIndex !== undefined ? point.style.zIndex : (point.type === 'connect' ? 15 : 20),
      isConnect: point.type === 'connect',
    })
  }

  const addOrUpdatePoint = (point: MapPoint) => {
    const map = baseMap.mapInstance.value
    if (!map)
      return

    let feature = pointSource.getFeatureById(point.id)
    const coordinates = toMapCoord(point.coordinates)

    if (feature) {
      feature.setGeometry(new Point(coordinates))
    }
    else {
      feature = new Feature({ geometry: new Point(coordinates) })
      feature.setId(point.id)
      pointSource.addFeature(feature)
    }
    feature.setStyle(getPointStyle(point))

    const overlay = map.getOverlayById(point.id)
    if (point.comment && point.comment.trim() !== '') {
      let popupElement: HTMLElement
      let currentOverlay = overlay

      if (currentOverlay) {
        currentOverlay.setPosition(coordinates)
        popupElement = currentOverlay.getElement()!
        popupElement.innerHTML = point.comment
      }
      else {
        popupElement = document.createElement('div')
        popupElement.className = 'ol-popup-comment'
        popupElement.innerHTML = point.comment

        popupElement.onclick = (e) => {
          e.stopPropagation()
          setActivePointId(point.id)
          map.dispatchEvent({
            type: 'click',
            coordinate: coordinates,
            pixel: map.getPixelFromCoordinate(coordinates),
            originalEvent: e,
          } as any)
        }

        currentOverlay = new Overlay({
          element: popupElement,
          position: coordinates,
          positioning: 'bottom-center',
          offset: [0, -42],
          id: point.id,
        })
        map.addOverlay(currentOverlay)
      }

      popupElement.style.opacity = point.style?.opacity !== undefined ? String(point.style.opacity) : '1'

      if (point.style?.zIndex !== undefined && popupElement.parentElement) {
        popupElement.parentElement.style.zIndex = String(point.style.zIndex)
      }

      pointOverlays.set(point.id, {
        overlay: currentOverlay,
        element: popupElement,
        baseOpacity: point.style?.opacity,
        baseZIndex: point.style?.zIndex,
      })
      updateOverlayVisibilities()
    }
    else if (overlay) {
      pointOverlays.delete(point.id)
      map.removeOverlay(overlay)
    }
  }

  const removePoint = (pointId: string) => {
    pointOverlays.delete(pointId)
    const feature = pointSource.getFeatureById(pointId)
    if (feature)
      pointSource.removeFeature(feature)
    const overlay = baseMap.mapInstance.value?.getOverlayById(pointId)
    if (overlay)
      baseMap.mapInstance.value?.removeOverlay(overlay)
  }

  const clearPoints = () => {
    pointOverlays.clear()
    pointSource.clear()
    baseMap.mapInstance.value?.getOverlays().clear()
  }

  const addOrUpdateRoute = (route: MapRoute) => {
    const map = baseMap.mapInstance.value
    if (!map || !route.geometry || route.geometry.length < 2)
      return

    let feature = routeSource.getFeatureById(route.id)
    const coordinates = route.geometry.map(coord => toMapCoord(coord))
    const lineGeometry = new LineString(coordinates)

    if (feature) {
      feature.setGeometry(lineGeometry)
    }
    else {
      feature = new Feature({ geometry: lineGeometry })
      feature.setId(route.id)
      routeSource.addFeature(feature)
    }

    const routeColor = route.color || '#4363D8'
    feature.setStyle(createRouteStyles(lineGeometry, routeColor, route.isDirect))
  }

  const removeRoute = (routeId: string) => {
    const feature = routeSource.getFeatureById(routeId)
    if (feature)
      routeSource.removeFeature(feature)
  }

  const clearRoutes = () => {
    routeSource.clear()
  }

  const setSelectionMarker = (coords: Coordinate | null) => {
    selectionSource.clear()
    if (!coords)
      return

    const feature = new Feature({
      geometry: new Point(toMapCoord(coords)),
    })
    feature.setStyle(new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: 'rgba(230, 25, 75, 0.2)' }),
        stroke: new Stroke({
          color: '#E6194B',
          width: 3,
        }),
      }),
    }))
    selectionSource.addFeature(feature)
  }

  // Расчет маршрута делегируется в routingService
  const fetchRoute = async (
    waypoints: MapPoint[],
    transportMode: TransportMode = 'foot',
  ): Promise<(Partial<MapRoute> & { isDirect?: boolean }) | null> => {
    if (waypoints.length < 2)
      return null
    return routingService.calculateRoute(waypoints, transportMode)
  }

  // Получение адреса делегируется в nominatimService
  const fetchAddress = async (coordinates: Coordinate) => {
    return nominatimService.reverse(coordinates)
  }

  const flyToLocation = (longitude: number, latitude: number, zoom = 14) => {
    baseMap.flyTo(longitude, latitude, zoom)
  }

  const clearSearchResult = () => {
    searchResultSource.clear()
    const overlay = baseMap.mapInstance.value?.getOverlayById(SEARCH_RESULT_OVERLAY_ID)
    if (overlay)
      baseMap.mapInstance.value?.removeOverlay(overlay)
  }

  async function searchLocation(query: string): Promise<boolean> {
    clearSearchResult()
    if (!query.trim())
      return false

    const result = await nominatimService.searchSingle(query)
    if (!result)
      return false

    const { lon, lat, displayName } = result
    const coordinates = toMapCoord([lon, lat])
    flyToLocation(lon, lat, 15)

    const feature = new Feature({ geometry: new Point(coordinates) })
    feature.setStyle(createMarkerStyle({ color: '#E74C3C', scale: 1.5 }))
    searchResultSource.addFeature(feature)

    const popupElement = document.createElement('div')
    popupElement.className = 'ol-popup-comment'
    popupElement.innerHTML = displayName
    const searchOverlay = new Overlay({
      element: popupElement,
      position: coordinates,
      positioning: 'bottom-center',
      offset: [0, -42],
      id: SEARCH_RESULT_OVERLAY_ID,
    })
    baseMap.mapInstance.value?.addOverlay(searchOverlay)

    return true
  }

  const showCurrentLocation = () => {
    if (!navigator.geolocation) {
      useToast().error('Геолокация не поддерживается вашим браузером.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!baseMap.mapInstance.value)
          return

        const { longitude, latitude } = position.coords
        flyToLocation(longitude, latitude, 16)

        currentLocationSource.clear()

        const locationFeature = new Feature({
          geometry: new Point(toMapCoord([longitude, latitude])),
        })

        locationFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#3498db' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }))

        currentLocationSource.addFeature(locationFeature)
      },
      () => {
        useToast().error('Не удалось определить местоположение.')
      },
      { enableHighAccuracy: true },
    )
  }

  onUnmounted(() => {
    if (cleanUpRmbListeners) {
      cleanUpRmbListeners()
      cleanUpRmbListeners = null
    }
  })

  return {
    mapInstance: baseMap.mapInstance,
    isMapLoaded: baseMap.isMapReady,
    modifyInteraction,
    initMap,
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
  }
}
