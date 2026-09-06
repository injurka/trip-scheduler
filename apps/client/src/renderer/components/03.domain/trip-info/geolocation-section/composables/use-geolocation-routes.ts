import type { Ref } from 'vue'
import type { Coordinate, MapPoint, MapRoute, TransportMode } from '../models/types'
import type { useGeolocationMap } from './use-geolocation-map'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { nominatimService, routingService } from '~/shared/services/geo'
import { POI_COLORS } from '../constant'

type GeolocationMapApi = ReturnType<typeof useGeolocationMap>

function formatCoordsLabel(coords: Coordinate, prefix: string): string {
  return `${prefix} (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`
}

export function useGeolocationRoutes(mapApiRef: Ref<GeolocationMapApi | undefined>) {
  const routes = ref<MapRoute[]>([])
  const isLoading = ref(false)

  async function createNewRoute(startCoords: Coordinate, transportMode: TransportMode = 'foot') {
    const startPoint: MapPoint = {
      id: uuidv4(),
      coordinates: startCoords,
      type: 'start',
      address: formatCoordsLabel(startCoords, 'Старт'),
    }

    const newRoute: MapRoute = {
      id: uuidv4(),
      title: `Маршрут ${routes.value.length + 1}`,
      points: [startPoint],
      transportMode,
      isVisible: true,
      isFetching: false,
      color: POI_COLORS[routes.value.length % POI_COLORS.length],
    }

    routes.value = [...routes.value, newRoute]
    mapApiRef.value?.addOrUpdatePoint(startPoint)
    return newRoute
  }

  async function addPointToRoute(routeId: string, coords: Coordinate, pointType: 'via' | 'connect' = 'via') {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1)
      return

    const route = routes.value[routeIndex]
    let updatedPoints = [...route.points]

    if (updatedPoints.length > 0) {
      const lastPoint = updatedPoints[updatedPoints.length - 1]
      if (lastPoint.type === 'end') {
        updatedPoints = updatedPoints.map((p, index) =>
          index === updatedPoints.length - 1 ? { ...p, type: 'via' } : p,
        )
      }
    }

    const finalType = pointType === 'connect' ? 'connect' : 'end'
    const label = pointType === 'connect' ? 'Соединительная точка' : formatCoordsLabel(coords, 'Точка')

    const newPoint: MapPoint = {
      id: uuidv4(),
      coordinates: coords,
      type: finalType,
      address: label,
    }

    updatedPoints.push(newPoint)

    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    mapApiRef.value?.addOrUpdatePoint(newPoint)
    await updateRouteGeometry(routeId)
  }

  async function deleteRoute(routeId: string) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex !== -1) {
      const routeToDelete = routes.value[routeIndex]
      routeToDelete.points.forEach(p => mapApiRef.value?.removePoint(p.id))
      mapApiRef.value?.removeRoute(routeId)
      routes.value = routes.value.filter(r => r.id !== routeId)
    }
  }

  async function deletePointFromRoute(routeId: string, pointId: string) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1)
      return

    const route = routes.value[routeIndex]
    mapApiRef.value?.removePoint(pointId)

    let updatedPoints = route.points.filter(p => p.id !== pointId)

    if (updatedPoints.length > 0) {
      updatedPoints = updatedPoints.map((p, index) => {
        if (index === 0)
          return { ...p, type: 'start' }
        if (index === updatedPoints.length - 1 && p.type !== 'connect')
          return { ...p, type: 'end' }
        return p
      })
    }

    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    await updateRouteGeometry(routeId)
  }

  async function updatePointInRoute(pointId: string, newCoords: Coordinate, shouldUpdateAddress: boolean = false) {
    let routeOfPoint: MapRoute | undefined
    for (const route of routes.value) {
      const point = route.points.find(p => p.id === pointId)
      if (point) {
        routeOfPoint = route
        point.coordinates = newCoords

        if (shouldUpdateAddress && point.type !== 'connect') {
          isLoading.value = true
          const addressInfo = await nominatimService.reverse(newCoords)
          isLoading.value = false
          point.address = addressInfo?.address || formatCoordsLabel(newCoords, 'Точка')
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

    await updatePointInRoute(pointId, point.coordinates, true)
    useToast().success('Адрес точки в маршруте обновлен.')
  }

  function handlePointDataUpdate(routeId: string, point: MapPoint) {
    const routeIndex = routes.value.findIndex(r => r.id === routeId)
    if (routeIndex === -1)
      return

    const route = routes.value[routeIndex]
    const updatedPoints = route.points.map(p => (p.id === point.id ? { ...point } : p))
    const updatedRoute = { ...route, points: updatedPoints }
    routes.value = routes.value.map(r => (r.id === routeId ? updatedRoute : r))

    mapApiRef.value?.addOrUpdatePoint(point)
  }

  async function updateRouteGeometry(routeId: string) {
    const route = routes.value.find(r => r.id === routeId)
    if (!route)
      return

    if (route.points.length < 2) {
      route.geometry = []
      route.distance = 0
      route.duration = 0
      mapApiRef.value?.removeRoute(routeId)
      return
    }

    route.isFetching = true
    const routeData = await routingService.calculateRoute(route.points, route.transportMode || 'foot')
    route.isFetching = false

    if (routeData) {
      route.geometry = routeData.geometry
      route.distance = routeData.distance
      route.duration = routeData.duration
      route.isDirect = routeData.isDirect
      mapApiRef.value?.addOrUpdateRoute(route)
    }
  }

  async function setRouteTransportMode(routeId: string, mode: TransportMode) {
    const route = routes.value.find(r => r.id === routeId)
    if (!route)
      return
    route.transportMode = mode
    await updateRouteGeometry(routeId)
  }

  async function setInitialRoutes(initialRoutes?: MapRoute[]) {
    routes.value = JSON.parse(JSON.stringify(initialRoutes || []))

    const routeUpdatePromises = routes.value.map((route) => {
      route.points.forEach(point => mapApiRef.value?.addOrUpdatePoint(point))
      return updateRouteGeometry(route.id)
    })
    await Promise.all(routeUpdatePromises)
  }

  return {
    routes,
    isLoading,
    createNewRoute,
    addPointToRoute,
    deleteRoute,
    deletePointFromRoute,
    updatePointInRoute,
    refreshRoutePointAddress,
    handlePointDataUpdate,
    setInitialRoutes,
    setRouteTransportMode,
    updateRouteGeometry,
  }
}
