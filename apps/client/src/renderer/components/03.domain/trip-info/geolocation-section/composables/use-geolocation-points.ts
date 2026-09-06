import type { Ref } from 'vue'
import type { Coordinate, MapPoint } from '../models/types'
import type { useGeolocationMap } from './use-geolocation-map'
import { v4 as uuidv4 } from 'uuid'
import { ref, watch } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { POI_COLORS } from '../constant'

type GeolocationMapApi = ReturnType<typeof useGeolocationMap>

function formatCoordsLabel(coords: Coordinate): string {
  return `Метка (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`
}

export function useGeolocationPoints(mapApiRef: Ref<GeolocationMapApi | undefined>) {
  const isLoading = ref(false)
  const points = ref<MapPoint[]>([])
  const pointToMoveId = ref<string | null>(null)
  const mode = ref<'pan' | 'add_point' | 'add_route_point' | 'draw_route' | 'move_point'>('pan')

  // Мгновенное добавление метки на карту без вызова геокодера
  async function addPoiPoint(coords: Coordinate) {
    if (!mapApiRef.value)
      return

    const newPoint: MapPoint = {
      id: uuidv4(),
      coordinates: coords,
      type: 'poi',
      address: formatCoordsLabel(coords),
      comment: '',
    }
    points.value = [...points.value, newPoint]
    mapApiRef.value.addOrUpdatePoint(newPoint)
  }

  async function deletePoiPoint(pointId: string) {
    if (!mapApiRef.value)
      return
    mapApiRef.value.removePoint(pointId)
    points.value = points.value.filter(p => p.id !== pointId)
  }

  function startMovePoint(pointId: string) {
    pointToMoveId.value = pointId
    mode.value = 'move_point'
  }

  // Перемещение метки без автоматического обращения к Nominatim
  async function movePoint(pointId: string, newCoords: Coordinate) {
    if (!mapApiRef.value)
      return
    const point = points.value.find(p => p.id === pointId)
    if (!point)
      return

    point.coordinates = newCoords
    // Если адрес еще не был получен, обновляем координаты в тексте
    if (!point.address || point.address.startsWith('Метка (')) {
      point.address = formatCoordsLabel(newCoords)
    }
    mapApiRef.value.addOrUpdatePoint(point)

    pointToMoveId.value = null
    mode.value = 'pan'
  }

  async function updatePointCoords(point: MapPoint) {
    if (!mapApiRef.value)
      return
    const lon = Number(point.coordinates[0])
    const lat = Number(point.coordinates[1])

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      useToast().error('Неверный формат координат!')
      return
    }
    point.coordinates = [lon, lat]

    await movePoint(point.id, point.coordinates)
    mapApiRef.value.flyToLocation(lon, lat, 16)
  }

  function handlePointUpdate(point: MapPoint) {
    if (!mapApiRef.value)
      return
    mapApiRef.value.addOrUpdatePoint(point)
    points.value = points.value.map(p => (p.id === point.id ? { ...point } : p))
  }

  // Явный запрос адреса по кнопке 🔄
  async function refreshPointAddress(pointId: string) {
    const pointIndex = points.value.findIndex(p => p.id === pointId)
    if (pointIndex === -1 || !mapApiRef.value)
      return

    const point = points.value[pointIndex]
    isLoading.value = true
    const addressInfo = await mapApiRef.value.fetchAddress(point.coordinates)
    isLoading.value = false

    const updatedPoint = {
      ...point,
      address: addressInfo?.address || 'Адрес не найден',
    }

    points.value = [
      ...points.value.slice(0, pointIndex),
      updatedPoint,
      ...points.value.slice(pointIndex + 1),
    ]

    mapApiRef.value.addOrUpdatePoint(updatedPoint)
    useToast().success('Адрес точки обновлен.')
  }

  function setInitialPoints(initialPoints: MapPoint[]) {
    if (!mapApiRef.value || !initialPoints)
      return
    points.value = JSON.parse(JSON.stringify(initialPoints))
    points.value.forEach(p => mapApiRef.value!.addOrUpdatePoint(p))
  }

  watch(points, (currentPoints) => {
    if (!mapApiRef.value)
      return
    const poiPoints = currentPoints.filter(p => p.type === 'poi')
    poiPoints.forEach((point, index) => {
      const color = POI_COLORS[index % POI_COLORS.length]
      if (point.style?.color !== color) {
        const updatedPoint = { ...point, style: { ...point.style, color } }
        mapApiRef.value!.addOrUpdatePoint(updatedPoint)
        const originalPoint = points.value.find(p => p.id === updatedPoint.id)
        if (originalPoint)
          originalPoint.style = updatedPoint.style
      }
    })
  }, { deep: true, immediate: true })

  return {
    points,
    isLoading,
    mode,
    pointToMoveId,
    addPoiPoint,
    deletePoiPoint,
    startMovePoint,
    movePoint,
    updatePointCoords,
    handlePointUpdate,
    refreshPointAddress,
    setInitialPoints,
  }
}
