import type { OSM, XYZ } from 'ol/source'
import type { TileSourceId } from '../constant/map-styles'
import type { Coordinate, DrawnRoute, GeolocationMapOptions, MapPoint, MapRoute, OSRMResponse } from '../models/types'
import Polyline from '@mapbox/polyline'
import { Feature, Map, Overlay, View } from 'ol'
import { LineString, MultiLineString, Point } from 'ol/geom'
import { Modify } from 'ol/interaction'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Vector as VectorSource } from 'ol/source'
import { Circle as CircleStyle, Fill, Icon as OlIcon, Stroke, Style } from 'ol/style'
import { TILE_SOURCES } from '../constant/map-styles'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const OSRM_API_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
const SEARCH_RESULT_OVERLAY_ID = 'search-result-overlay'

function useGeolocationMap() {
  const mapInstance: Ref<Map | null> = ref(null)
  const isMapLoaded = ref(false)

  // --- Источники и слои ---
  const tileLayerRef = ref<TileLayer<OSM | XYZ> | null>(null)
  const pointSource = new VectorSource()
  const routeSource = new VectorSource()
  const drawSource = new VectorSource()
  const searchResultSource = new VectorSource() // Для результатов поиска
  const currentLocationSource = new VectorSource() // Для местоположения пользователя

  const pointLayer = new VectorLayer({ source: pointSource, zIndex: 10 })
  const routeLayer = new VectorLayer({ source: routeSource, zIndex: 5 })
  const drawLayer = new VectorLayer({ source: drawSource, zIndex: 6 })
  const searchResultLayer = new VectorLayer({ source: searchResultSource, zIndex: 11 }) // Слой для результатов поиска
  const currentLocationLayer = new VectorLayer({ source: currentLocationSource, zIndex: 12 }) // Слой для местоположения

  // --- Взаимодействия (Interactions) ---
  const modifyInteraction = new Modify({ source: pointSource })

  const popups: Ref<Overlay[]> = ref([])
  let resizeObserver: ResizeObserver | null = null

  // --- Инициализация и уничтожение ---
  const initMap = async (options: GeolocationMapOptions) => {
    if (!options.container) {
      console.error('Map container is required')
      return
    }
    await nextTick()
    try {
      const initialTileLayer = new TileLayer({
        source: TILE_SOURCES.maptilerStreets.source,
      })
      tileLayerRef.value = initialTileLayer

      mapInstance.value = new Map({
        target: options.container,
        layers: [initialTileLayer, routeLayer, drawLayer, pointLayer, searchResultLayer, currentLocationLayer],
        view: new View({
          center: fromLonLat(options.center),
          zoom: options.zoom || 12,
        }),
        controls: [],
      })

      mapInstance.value.addInteraction(modifyInteraction)
      modifyInteraction.setActive(options.interactive ?? true)

      mapInstance.value.once('postrender', () => {
        isMapLoaded.value = true
        mapInstance.value?.updateSize()
      })

      const container
        = typeof options.container === 'string'
          ? document.getElementById(options.container)
          : options.container
      if (container) {
        resizeObserver = new ResizeObserver(() => {
          mapInstance.value?.updateSize()
        })
        resizeObserver.observe(container)
      }
    }
    catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }

  const destroyMap = () => {
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

  // --- Управление точками (маркерами) ---
  function getPointStyle(point: MapPoint): Style {
    const colors = {
      poi: '#3498db',
      start: '#2ecc71',
      via: '#f1c40f',
      end: '#e74c3c',
    }
    const color = point.style?.color || colors[point.type] || '#3498db'
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
      }),
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
      if (overlay) {
        overlay.setPosition(coordinates)
        overlay.getElement()!.innerHTML = point.comment
      }
      else {
        const popupElement = document.createElement('div')
        popupElement.className = 'ol-popup-comment'
        popupElement.innerHTML = point.comment
        const newOverlay = new Overlay({
          element: popupElement,
          position: coordinates,
          positioning: 'bottom-center',
          offset: [0, -42],
          id: point.id,
        })
        mapInstance.value.addOverlay(newOverlay)
      }
    }
    else if (overlay) {
      mapInstance.value.removeOverlay(overlay)
    }
  }

  const removePoint = (pointId: string) => {
    const feature = pointSource.getFeatureById(pointId)
    if (feature)
      pointSource.removeFeature(feature)
    const overlay = mapInstance.value?.getOverlayById(pointId)
    if (overlay)
      mapInstance.value!.removeOverlay(overlay)
  }

  const clearPoints = () => {
    pointSource.clear()
    mapInstance.value?.getOverlays().clear()
    popups.value = []
  }

  // --- Управление маршрутами ---
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

    feature.setStyle([
      // Style for the line
      new Style({
        stroke: new Stroke({
          color: route.color || '#4363D8',
          width: 4,
          lineDash: route.isDirect ? [10, 10] : undefined,
        }),
      }),
      // Style for the start point
      new Style({
        geometry: new Point(lineGeometry.getFirstCoordinate()),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({
            color: route.color || '#4363D8',
            width: 3,
          }),
        }),
      }),
      // Style for the end point
      new Style({
        geometry: new Point(lineGeometry.getLastCoordinate()),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: route.color || '#4363D8' }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 3,
          }),
        }),
      }),
    ])
  }

  const addOrUpdateDrawnRoute = (route: DrawnRoute) => {
    if (!mapInstance.value || !route.segments)
      return
    let feature = routeSource.getFeatureById(route.id)
    const coordinates = route.segments.map(segment =>
      segment.map(coord => fromLonLat(coord)),
    )
    const multiLineGeometry = new MultiLineString(coordinates)

    if (feature) {
      feature.setGeometry(multiLineGeometry)
    }
    else {
      feature = new Feature({ geometry: multiLineGeometry })
      feature.setId(route.id)
      routeSource.addFeature(feature)
    }

    const lineStrings = multiLineGeometry.getLineStrings()
    if (lineStrings.length > 0) {
      feature.setStyle([
        // Style for the line
        new Style({
          stroke: new Stroke({
            color: route.color || '#4363D8',
            width: 4,
          }),
        }),
        // Style for the start point
        new Style({
          geometry: new Point(lineStrings[0].getFirstCoordinate()),
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({
              color: route.color || '#4363D8',
              width: 3,
            }),
          }),
        }),
        // Style for the end point
        new Style({
          geometry: new Point(lineStrings[lineStrings.length - 1].getLastCoordinate()),
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: route.color || '#4363D8' }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 3,
            }),
          }),
        }),
      ])
    }
    else {
      feature.setStyle(
        new Style({
          stroke: new Stroke({
            color: route.color || '#4363D8',
            width: 4,
          }),
        }),
      )
    }
  }

  const removeRoute = (routeId: string) => {
    const feature = routeSource.getFeatureById(routeId)
    if (feature)
      routeSource.removeFeature(feature)
  }

  const clearRoutes = () => {
    routeSource.clear()
  }

  // --- Взаимодействие с API ---
  const fetchRoute = async (
    waypoints: MapPoint[],
  ): Promise<(Partial<MapRoute> & { isDirect?: boolean }) | null> => {
    if (waypoints.length < 2)
      return null
    const coordsString = waypoints.map(p => p.coordinates.join(',')).join(';')
    const url = `${OSRM_API_URL}/${coordsString}?overview=full&geometries=polyline&steps=false`
    try {
      const response = await fetch(url)
      const data: OSRMResponse = await response.json()
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.warn('OSRM не смог найти маршрут, будет построена прямая линия.', data)
        return {
          geometry: waypoints.map(p => p.coordinates),
          distance: 0,
          duration: 0,
          isDirect: true,
        }
      }
      const route = data.routes[0]
      const decodedGeometry = Polyline.decode(route.geometry).map(
        ([lat, lon]: [number, number]) => [lon, lat],
      ) as Coordinate[]
      return {
        geometry: decodedGeometry,
        distance: route.distance,
        duration: route.duration,
        isDirect: false,
      }
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
    const url = `${NOMINATIM_URL}?format=json&lon=${lon}&lat=${lat}&accept-language=ru`
    try {
      const response = await fetch(url)
      const data = await response.json()
      if (data.error) {
        console.error('Ошибка Nominatim:', data.error)
        return null
      }
      return {
        coordinates,
        address: data.display_name || 'Адрес не найден',
      }
    }
    catch (error) {
      console.error('Ошибка при запросе адреса из Nominatim:', error)
      return null
    }
  }

  // --- Утилиты ---
  function showPopup(
    coordinates: Coordinate,
    content: string,
    id: string = `popup-${Date.now()}`,
  ) {
    if (!mapInstance.value)
      return
    const popupElement = document.createElement('div')
    popupElement.innerHTML = content
    popupElement.className = 'ol-popup'
    const popup = new Overlay({
      element: popupElement,
      position: fromLonLat(coordinates),
      positioning: 'bottom-center',
      offset: [0, -40],
      id,
    })
    mapInstance.value.addOverlay(popup)
    popups.value.push(popup)
    return popup
  }

  function clearPopups() {
    popups.value.forEach(p => mapInstance.value?.removeOverlay(p))
    popups.value = []
  }

  function flyToLocation(longitude: number, latitude: number, zoom = 13) {
    if (!mapInstance.value)
      return

    mapInstance.value.getView().animate({
      center: fromLonLat([longitude, latitude]),
      zoom,
      duration: 1000,
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
      else {
        console.warn('Location not found for query:', query)
        return false
      }
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
      (error) => {
        let message = 'Не удалось определить ваше местоположение.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Вы запретили доступ к своему местоположению.'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'Информация о местоположении недоступна.'
            break
          case error.TIMEOUT:
            message = 'Время ожидания запроса местоположения истекло.'
            break
        }
        useToast().error(message)
      },
      {
        enableHighAccuracy: true,
      },
    )
  }

  onUnmounted(destroyMap)

  return {
    mapInstance,
    isMapLoaded: readonly(isMapLoaded),
    modifyInteraction,
    drawSource,
    initMap,
    setTileSource,
    addOrUpdatePoint,
    removePoint,
    clearPoints,
    fetchAddress,
    flyToLocation,
    searchLocation,
    clearSearchResult,
    showPopup,
    clearPopups,
    fetchRoute,
    addOrUpdateRoute,
    addOrUpdateDrawnRoute,
    removeRoute,
    clearRoutes,
    showCurrentLocation,
  }
}

export { useGeolocationMap }
