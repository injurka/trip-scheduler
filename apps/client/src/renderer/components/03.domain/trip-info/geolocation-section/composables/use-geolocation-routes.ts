import type { Ref } from 'vue'
import type { Coordinate, DrawnRoute, MapPoint, MapRoute } from '../models/types'
import type { useGeolocationMap } from './use-geolocation-map'
import { v4 as uuidv4 } from 'uuid'
import { POI_COLORS } from '../constant'

type GeolocationMapApi = ReturnType<typeof useGeolocationMap>

export function useGeolocationRoutes(mapApiRef: Ref<GeolocationMapApi | undefined>) {
  const routes = ref<MapRoute[]>([])
  const drawnRoutes = ref<DrawnRoute[]>([])
  const isLoading = ref(false)

  // --- Управление маршрутами OSRM ---
  async function createNewRoute(startCoords: Coordinate) {
    if (!mapApiRef.value)
      return
    isLoading.value = true
    const addressInfo = await mapApiRef.value.fetchAddress(startCoords)
    isLoading.value = false

    const startPoint: MapPoint = {
      id: uuidv4(),
      coordinates: startCoords,
      type: 'start',
      address: addressInfo?.address || 'Начальная точка',
    }

    const newRoute: MapRoute = {
      id: uuidv4(),
      title: `Маршрут ${routes.value.length + 1}`,
      points: [startPoint],
      isVisible: true,
      isFetching: false,
      color: POI_COLORS[routes.value.length % POI_COLORS.length],
    }

    routes.value = [...routes.value, newRoute] // Создаем новый массив
    mapApiRef.value.addOrUpdatePoint(startPoint)
    return newRoute
  }

  async function addPointToRoute(routeId: string, coords: Coordinate) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1 || !mapApiRef.value)
      return

    isLoading.value = true
    const addressInfo = await mapApiRef.value.fetchAddress(coords)
    isLoading.value = false

    const route = routes.value[routeIndex]
    let updatedPoints = [...route.points]

    if (updatedPoints.length > 0) {
      const lastPoint = updatedPoints[updatedPoints.length - 1]
      if (lastPoint.type === 'start' || lastPoint.type === 'via') {
        // Создаем новый массив точек с измененным типом последней точки
        updatedPoints = updatedPoints.map((p, index) =>
          index === updatedPoints.length - 1 ? { ...p, type: 'via' } : p,
        )
      }
    }

    const newPoint: MapPoint = {
      id: uuidv4(),
      coordinates: coords,
      type: 'end',
      address: addressInfo?.address || 'Промежуточная точка',
    }

    updatedPoints.push(newPoint)

    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    mapApiRef.value.addOrUpdatePoint(newPoint)
    await updateRouteGeometry(routeId)
  }

  async function deleteRoute(routeId: string) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex !== -1) {
      const routeToDelete = routes.value[routeIndex]
      routeToDelete.points.forEach(p => mapApiRef.value!.removePoint(p.id))
      mapApiRef.value!.removeRoute(routeId)
      routes.value = routes.value.filter(r => r.id !== routeId)
      return
    }

    const drawnRouteIndex = drawnRoutes.value.findIndex(r => r.id === routeId)
    if (drawnRouteIndex !== -1) {
      mapApiRef.value!.removeRoute(routeId)
      drawnRoutes.value = drawnRoutes.value.filter(r => r.id !== routeId)
    }
  }

  async function deletePointFromRoute(routeId: string, pointId: string) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1 || !mapApiRef.value)
      return

    const route = routes.value[routeIndex]
    mapApiRef.value.removePoint(pointId)

    let updatedPoints = route.points.filter(p => p.id !== pointId)

    if (updatedPoints.length > 0) {
      updatedPoints = updatedPoints.map((p, index) => {
        if (index === 0)
          return { ...p, type: 'start' }
        if (index === updatedPoints.length - 1)
          return { ...p, type: 'end' }
        return { ...p, type: 'via' }
      })
    }

    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    await updateRouteGeometry(routeId)
  }

  async function updatePointInRoute(pointId: string, newCoords: Coordinate, shouldUpdateAddress: boolean = true) {
    let routeOfPoint: MapRoute | undefined
    for (const route of routes.value) {
      const point = route.points.find(p => p.id === pointId)
      if (point) {
        routeOfPoint = route
        point.coordinates = newCoords

        if (shouldUpdateAddress) {
          isLoading.value = true
          const addressInfo = await mapApiRef.value?.fetchAddress(newCoords)
          isLoading.value = false
          point.address = addressInfo?.address || 'Адрес не найден'
        }

        mapApiRef.value?.addOrUpdatePoint(point)
        break
      }
    }
    if (routeOfPoint)
      await updateRouteGeometry(routeOfPoint.id)
  }

  async function refreshRoutePointAddress(routeId: string, pointId: string) {
    const route = routes.value.find(r => r.id === routeId)
    if (!route)
      return
    const point = route.points.find(p => p.id === pointId)
    if (!point)
      return

    // Эта функция уже содержит логику для обновления адреса
    await updatePointInRoute(pointId, point.coordinates, true)
    useToast().success('Адрес точки в маршруте обновлен.')
  }

  function handlePointDataUpdate(routeId: string, point: MapPoint) {
    if (!mapApiRef.value)
      return
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1)
      return

    const route = routes.value[routeIndex]
    const updatedPoints = route.points.map(p => (p.id === point.id ? { ...point } : p))
    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    mapApiRef.value.addOrUpdatePoint(point)
  }

  async function updateRouteGeometry(routeId: string) {
    const route = routes.value.find(r => r.id === routeId)
    if (!route || !mapApiRef.value)
      return
    if (route.points.length < 2) {
      route.geometry = []
      route.distance = 0
      mapApiRef.value.removeRoute(routeId)
      return
    }

    route.isFetching = true
    const routeData = await mapApiRef.value.fetchRoute(route.points)
    route.isFetching = false

    if (routeData) {
      route.geometry = routeData.geometry
      route.distance = routeData.distance
      route.duration = routeData.duration
      route.isDirect = routeData.isDirect
      mapApiRef.value.addOrUpdateRoute(route)
    }
  }

  async function setInitialRoutes(initialData: { routes?: MapRoute[], drawnRoutes?: DrawnRoute[] }) {
    if (!mapApiRef.value)
      return

    routes.value = JSON.parse(JSON.stringify(initialData.routes || []))
    drawnRoutes.value = JSON.parse(JSON.stringify(initialData.drawnRoutes || []))

    const routeUpdatePromises = routes.value.map((route) => {
      route.points.forEach(point => mapApiRef.value!.addOrUpdatePoint(point))
      return updateRouteGeometry(route.id)
    })
    drawnRoutes.value.forEach((route) => {
      mapApiRef.value!.addOrUpdateDrawnRoute(route)
    })
    await Promise.all(routeUpdatePromises)
  }

  // --- Управление нарисованными маршрутами ---
  function addDrawnRoute(coords: Coordinate[]) {
    const newDrawnRoute: DrawnRoute = {
      id: uuidv4(),
      title: `Рисованный маршрут ${drawnRoutes.value.length + 1}`,
      segments: [coords],
      isVisible: true,
      color: POI_COLORS[(routes.value.length + drawnRoutes.value.length) % POI_COLORS.length],
    }
    drawnRoutes.value = [...drawnRoutes.value, newDrawnRoute]
    mapApiRef.value?.addOrUpdateDrawnRoute(newDrawnRoute)
  }

  function addSegmentToDrawnRoute(routeId: string, segmentCoords: Coordinate[]) {
    drawnRoutes.value = drawnRoutes.value.map((route) => {
      if (route.id === routeId) {
        const updatedRoute = { ...route, segments: [...route.segments, segmentCoords] }
        mapApiRef.value?.addOrUpdateDrawnRoute(updatedRoute)
        return updatedRoute
      }
      return route
    })
  }

  function deleteSegmentFromDrawnRoute(routeId: string, segmentIndex: number) {
    const route = drawnRoutes.value.find(r => r.id === routeId)
    if (route && mapApiRef.value) {
      const updatedSegments = route.segments.filter((_, index) => index !== segmentIndex)
      if (updatedSegments.length === 0) {
        deleteRoute(routeId)
      }
      else {
        const updatedRoute = { ...route, segments: updatedSegments }
        drawnRoutes.value = drawnRoutes.value.map(r => (r.id === routeId ? updatedRoute : r))
        mapApiRef.value.addOrUpdateDrawnRoute(updatedRoute)
      }
    }
  }

  return {
    routes,
    drawnRoutes,
    isLoading,
    createNewRoute,
    addPointToRoute,
    deleteRoute,
    deletePointFromRoute,
    updatePointInRoute,
    refreshRoutePointAddress,
    handlePointDataUpdate,
    setInitialRoutes,
    addDrawnRoute,
    addSegmentToDrawnRoute,
    deleteSegmentFromDrawnRoute,
  }
}
