import type { OSM, XYZ } from 'ol/source'
import type { Ref } from 'vue'
import type { Coordinate, GeolocationMapOptions, MapPoint, MapRoute, OSRMResponse, TransportMode } from '../models/types'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import Polyline from '@mapbox/polyline'
import { Feature, Map as OlMap, Overlay, View } from 'ol'
import { Attribution, defaults as defaultControls } from 'ol/control'
import { LineString, Point } from 'ol/geom'
import { Modify } from 'ol/interaction'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Vector as VectorSource } from 'ol/source'
import { Circle as CircleStyle, Fill, Icon as OlIcon, Stroke, Style } from 'ol/style'
import { onUnmounted, readonly, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { checkMapTilerAvailability, TILE_SOURCES } from '~/shared/lib/map-styles-sources'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const OSRM_ENDPOINTS: Record<TransportMode, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
}
const SEARCH_RESULT_OVERLAY_ID = 'search-result-overlay'

// ==========================================
// In-Memory Cache для маршрутов и адресов
// ==========================================
interface RouteCacheEntry {
  geometry: Coordinate[]
  distance: number
  duration: number
  isDirect: boolean
}

const MAX_ROUTE_CACHE_ENTRIES = 120
const MAX_ADDRESS_CACHE_ENTRIES = 300

const routeCache = new Map<string, RouteCacheEntry>()
const addressCache = new Map<string, string>()

function getRouteCacheKey(waypoints: MapPoint[], mode: TransportMode): string {
  const coordsKey = waypoints
    .map(p => `${p.coordinates[0].toFixed(5)},${p.coordinates[1].toFixed(5)}`)
    .join(';')
  return `${mode}::${coordsKey}`
}

function getAddressCacheKey(coords: Coordinate): string {
  return `${coords[0].toFixed(5)},${coords[1].toFixed(5)}`
}

function setWithLimit<K, V>(map: Map<K, V>, key: K, value: V, limit: number) {
  if (map.size >= limit) {
    const oldestKey = map.keys().next().value
    if (oldestKey !== undefined) {
      map.delete(oldestKey)
    }
  }
  map.set(key, value)
}

function useGeolocationMap() {
  const mapInstance: Ref<OlMap | null> = ref(null)
  const isMapLoaded = ref(false)

  const tileLayerRef = ref<TileLayer<OSM | XYZ> | null>(null)
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

  const popups: Ref<Overlay[]> = ref([])
  let resizeObserver: ResizeObserver | null = null
  let cleanUpRmbListeners: (() => void) | null = null

  const activePointId = ref<string | null>(null)
  const hoveredPointId = ref<string | null>(null)
  const currentZoom = ref<number>(12)
  const minZoomForComments = 13

  interface PointOverlayItem {
    overlay: Overlay
    element: HTMLElement
    baseOpacity?: number
    baseZIndex?: number
  }
  const pointOverlays = new Map<string, PointOverlayItem>()

  const updateOverlayVisibilities = () => {
    const isZoomedIn = (currentZoom.value ?? 0) >= minZoomForComments

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

        const view = mapInstance.value?.getView()
        const center = view?.getCenter()
        if (center) {
          initialCenterX = center[0]
        }
        containerEl.style.cursor = 'ew-resize'
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isRmbDragging || !mapInstance.value)
        return

      const view = mapInstance.value.getView()
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
      console.error('Map container is required')
      return
    }

    try {
      const isMapTilerWorking = await checkMapTilerAvailability()

      const initialSource = isMapTilerWorking
        ? TILE_SOURCES.maptilerOutdoor.source
        : TILE_SOURCES.osm.source

      const initialTileLayer = new TileLayer({
        source: initialSource,
      })
      tileLayerRef.value = initialTileLayer

      const initialZoom = options.zoom || 12
      currentZoom.value = initialZoom

      const view = new View({
        center: fromLonLat(options.center),
        zoom: initialZoom,
      })

      const containerEl
        = typeof options.container === 'string'
          ? document.getElementById(options.container)!
          : options.container

      // Включаем легальную атрибуцию (копирайт) OSM & MapTiler
      const controls = defaultControls({
        zoom: false,
        rotate: false,
        attribution: false,
      }).extend([
        new Attribution({
          collapsible: true,
        }),
      ])

      mapInstance.value = new OlMap({
        target: containerEl,
        layers: [initialTileLayer, routeLayer, selectionLayer, pointLayer, searchResultLayer, currentLocationLayer],
        view,
        controls,
      })

      setupRmbHorizontalPan(containerEl)

      view.on('change:resolution', () => {
        currentZoom.value = view.getZoom() ?? 12
        updateOverlayVisibilities()
      })

      mapInstance.value.on('pointermove', (evt) => {
        if (evt.dragging || !mapInstance.value)
          return

        const feature = mapInstance.value.forEachFeatureAtPixel(
          evt.pixel,
          f => f,
          {
            hitTolerance: 6,
            layerFilter: layer => layer === pointLayer || layer === searchResultLayer,
          },
        )

        const targetElement = mapInstance.value.getTargetElement()
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

      mapInstance.value.addInteraction(modifyInteraction)
      modifyInteraction.setActive(options.interactive ?? true)

      mapInstance.value.once('postrender', () => {
        isMapLoaded.value = true
        mapInstance.value?.updateSize()
        updateOverlayVisibilities()
      })

      resizeObserver = new ResizeObserver(() => {
        mapInstance.value?.updateSize()
      })
      resizeObserver.observe(containerEl)
    }
    catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }

  const destroyMap = () => {
    if (cleanUpRmbListeners) {
      cleanUpRmbListeners()
      cleanUpRmbListeners = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (mapInstance.value) {
      mapInstance.value.setTarget(undefined)
      mapInstance.value = null
      isMapLoaded.value = false
    }
  }

  const setTileSource = (sourceId: TileSourceId) => {
    if (tileLayerRef.value && TILE_SOURCES[sourceId]) {
      tileLayerRef.value.setSource(TILE_SOURCES[sourceId].source)
    }
  }

  function getPointStyle(point: MapPoint): Style {
    const colors = {
      poi: '#3498db',
      start: '#2ecc71',
      via: '#f1c40f',
      end: '#e74c3c',
      connect: '#95a5a6',
    }
    const color = point.style?.color || colors[point.type] || '#3498db'
    const opacity = point.style?.opacity !== undefined ? point.style.opacity : 1.0

    if (point.type === 'connect') {
      return new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({
            color,
            width: 2,
          }),
        }),
        zIndex: point.style?.zIndex !== undefined ? point.style.zIndex : 15,
      })
    }

    const svg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `
    return new Style({
      image: new OlIcon({
        src: `data:image/svg+xml;base64,${btoa(svg)}`,
        scale: point.style?.scale || 1.5,
        anchor: [0.5, 1],
        opacity,
      }),
      zIndex: point.style?.zIndex !== undefined ? point.style.zIndex : 20,
    })
  }

  const addOrUpdatePoint = (point: MapPoint) => {
    if (!mapInstance.value)
      return
    let feature = pointSource.getFeatureById(point.id)
    const coordinates = fromLonLat(point.coordinates)
    if (feature) {
      feature.setGeometry(new Point(coordinates))
    }
    else {
      feature = new Feature({ geometry: new Point(coordinates) })
      feature.setId(point.id)
      pointSource.addFeature(feature)
    }
    feature.setStyle(getPointStyle(point))

    const overlay = mapInstance.value.getOverlayById(point.id)
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
          mapInstance.value?.dispatchEvent({
            type: 'click',
            coordinate: coordinates,
            pixel: mapInstance.value?.getPixelFromCoordinate(coordinates),
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
        mapInstance.value.addOverlay(currentOverlay)
      }

      if (point.style?.opacity !== undefined) {
        popupElement.style.opacity = String(point.style.opacity)
      }
      else {
        popupElement.style.opacity = '1'
      }

      if (point.style?.zIndex !== undefined) {
        const parent = popupElement.parentElement
        if (parent) {
          parent.style.zIndex = String(point.style.zIndex)
        }
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
      mapInstance.value.removeOverlay(overlay)
    }
  }

  const removePoint = (pointId: string) => {
    pointOverlays.delete(pointId)
    const feature = pointSource.getFeatureById(pointId)
    if (feature)
      pointSource.removeFeature(feature)
    const overlay = mapInstance.value?.getOverlayById(pointId)
    if (overlay)
      mapInstance.value!.removeOverlay(overlay)
  }

  const clearPoints = () => {
    pointOverlays.clear()
    pointSource.clear()
    mapInstance.value?.getOverlays().clear()
    popups.value = []
  }

  const addOrUpdateRoute = (route: MapRoute) => {
    if (!mapInstance.value || !route.geometry)
      return

    let feature = routeSource.getFeatureById(route.id)
    const coordinates = route.geometry.map(coord => fromLonLat(coord))
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

    feature.setStyle([
      new Style({
        stroke: new Stroke({
          color: '#ffffff',
          width: 7,
          lineCap: 'round',
          lineJoin: 'round',
        }),
        zIndex: 1,
      }),
      new Style({
        stroke: new Stroke({
          color: routeColor,
          width: 4,
          lineDash: route.isDirect ? [8, 8] : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }),
        zIndex: 2,
      }),
      new Style({
        geometry: new Point(lineGeometry.getFirstCoordinate()),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({
            color: routeColor,
            width: 3,
          }),
        }),
        zIndex: 3,
      }),
      new Style({
        geometry: new Point(lineGeometry.getLastCoordinate()),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: routeColor }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 3,
          }),
        }),
        zIndex: 3,
      }),
    ])
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
      geometry: new Point(fromLonLat(coords)),
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

  const fetchRoute = async (
    waypoints: MapPoint[],
    transportMode: TransportMode = 'foot',
  ): Promise<(Partial<MapRoute> & { isDirect?: boolean }) | null> => {
    if (waypoints.length < 2)
      return null

    const cacheKey = getRouteCacheKey(waypoints, transportMode)
    const cached = routeCache.get(cacheKey)
    if (cached) {
      return {
        geometry: [...cached.geometry],
        distance: cached.distance,
        duration: cached.duration,
        isDirect: cached.isDirect,
      }
    }

    const coordsString = waypoints.map(p => p.coordinates.join(',')).join(';')
    const endpoint = OSRM_ENDPOINTS[transportMode] || OSRM_ENDPOINTS.foot
    const url = `${endpoint}/${coordsString}?overview=full&geometries=polyline&steps=false`

    try {
      const response = await fetch(url)
      const data: OSRMResponse = await response.json()
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        const fallbackResult: RouteCacheEntry = {
          geometry: waypoints.map(p => p.coordinates),
          distance: 0,
          duration: 0,
          isDirect: true,
        }
        setWithLimit(routeCache, cacheKey, fallbackResult, MAX_ROUTE_CACHE_ENTRIES)
        return fallbackResult
      }

      const route = data.routes[0]
      const decodedGeometry = Polyline.decode(route.geometry).map(
        ([lat, lon]: [number, number]) => [lon, lat],
      ) as Coordinate[]

      const successResult: RouteCacheEntry = {
        geometry: decodedGeometry,
        distance: route.distance,
        duration: route.duration,
        isDirect: false,
      }

      setWithLimit(routeCache, cacheKey, successResult, MAX_ROUTE_CACHE_ENTRIES)
      return successResult
    }
    catch (error) {
      console.error('Ошибка при запросе маршрута из OSRM:', error)
      return {
        geometry: waypoints.map(p => p.coordinates),
        distance: 0,
        duration: 0,
        isDirect: true,
      }
    }
  }

  const fetchAddress = async (coordinates: Coordinate) => {
    const [lon, lat] = coordinates
    const cacheKey = getAddressCacheKey(coordinates)

    if (addressCache.has(cacheKey)) {
      return {
        coordinates,
        address: addressCache.get(cacheKey)!,
      }
    }

    const url = `${NOMINATIM_URL}?format=json&lon=${lon}&lat=${lat}&accept-language=ru`
    try {
      const response = await fetch(url)
      const data = await response.json()
      if (data.error) {
        return null
      }

      const address = data.display_name || 'Адрес не найден'
      setWithLimit(addressCache, cacheKey, address, MAX_ADDRESS_CACHE_ENTRIES)

      return {
        coordinates,
        address,
      }
    }
    catch (error) {
      console.error('Ошибка запроса адреса:', error)
      return null
    }
  }

  function flyToLocation(longitude: number, latitude: number, zoom = 14) {
    if (!mapInstance.value)
      return

    mapInstance.value.getView().animate({
      center: fromLonLat([longitude, latitude]),
      zoom,
      duration: 700,
    })
  }

  const clearSearchResult = () => {
    searchResultSource.clear()
    if (mapInstance.value) {
      const overlay = mapInstance.value.getOverlayById(SEARCH_RESULT_OVERLAY_ID)
      if (overlay)
        mapInstance.value.removeOverlay(overlay)
    }
  }

  async function searchLocation(query: string): Promise<boolean> {
    clearSearchResult()
    if (!query.trim())
      return false

    const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ru`

    try {
      const response = await fetch(url)
      const data = await response.json()
      if (data && data.length > 0) {
        const result = data[0]
        const lon = Number.parseFloat(result.lon)
        const lat = Number.parseFloat(result.lat)
        const coordinates = fromLonLat([lon, lat])
        flyToLocation(lon, lat, 15)

        const feature = new Feature({ geometry: new Point(coordinates) })
        const style = new Style({
          image: new OlIcon({
            anchor: [0.5, 1],
            scale: 1.5,
            src: `data:image/svg+xml;base64,${btoa(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#E74C3C"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `)}`,
          }),
        })
        feature.setStyle(style)
        searchResultSource.addFeature(feature)

        const popupElement = document.createElement('div')
        popupElement.className = 'ol-popup-comment'
        popupElement.innerHTML = result.display_name
        const searchOverlay = new Overlay({
          element: popupElement,
          position: coordinates,
          positioning: 'bottom-center',
          offset: [0, -42],
          id: SEARCH_RESULT_OVERLAY_ID,
        })
        mapInstance.value?.addOverlay(searchOverlay)

        return true
      }
      return false
    }
    catch (error) {
      console.error('Error searching location:', error)
      return false
    }
  }

  const showCurrentLocation = () => {
    if (!navigator.geolocation) {
      useToast().error('Геолокация не поддерживается вашим браузером.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mapInstance.value)
          return

        const { longitude, latitude } = position.coords
        flyToLocation(longitude, latitude, 16)

        currentLocationSource.clear()

        const locationFeature = new Feature({
          geometry: new Point(fromLonLat([longitude, latitude])),
        })

        locationFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({
              color: '#3498db',
            }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 2,
            }),
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

  onUnmounted(destroyMap)

  return {
    mapInstance,
    isMapLoaded: readonly(isMapLoaded),
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
    currentZoom: readonly(currentZoom),
    setActivePointId,
    showCurrentLocation,
  }
}

export { useGeolocationMap }
