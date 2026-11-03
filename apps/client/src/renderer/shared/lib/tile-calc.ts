import { isRecord } from '@injurka/type-utils'
/**
 * Утилиты для расчета координат и тайлов Slippy Map (X, Y, Z)
 */

export interface BoundingBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

/**
 * Перевод широты/долготы в координаты тайла (x, y) для указанного зума
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number, y: number } {
  const x = Math.floor(((lng + 180) / 360) * 2 ** zoom)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom)
  const maxTile = 2 ** zoom - 1

  return {
    x: Math.max(0, Math.min(maxTile, x)),
    y: Math.max(0, Math.min(maxTile, y)),
  }
}

/**
 * Расчет BoundingBox по точкам гео-секций, активностей и треков
 */
export function calculateTripBoundingBox(trip: unknown): BoundingBox | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let pointsCount = 0

  const addPoint = (lng: number, lat: number) => {
    if (typeof lng !== 'number' || typeof lat !== 'number' || Number.isNaN(lng) || Number.isNaN(lat))
      return

    // Валидация координат
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return

    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
    pointsCount++
  }

  const addCoordinate = (value: unknown) => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number')
      addPoint(value[0], value[1])
  }

  const checkSection = (section: unknown) => {
    if (!isRecord(section))
      return

    const target = isRecord(section.content) ? section.content : section

    if (Array.isArray(target.points)) {
      for (const point of target.points.filter(isRecord))
        addCoordinate(point.coordinates)
    }

    if (Array.isArray(target.routes)) {
      for (const route of target.routes.filter(isRecord)) {
        if (Array.isArray(route.points)) {
          for (const point of route.points.filter(isRecord))
            addCoordinate(point.coordinates)
        }

        if (Array.isArray(route.geometry))
          route.geometry.forEach(addCoordinate)
      }
    }

    addCoordinate(target.center)
  }

  if (!isRecord(trip))
    return null

  if (Array.isArray(trip.sections))
    trip.sections.forEach(checkSection)

  if (Array.isArray(trip.days)) {
    for (const day of trip.days.filter(isRecord)) {
      if (!Array.isArray(day.activities))
        continue

      for (const activity of day.activities.filter(isRecord)) {
        if (Array.isArray(activity.sections))
          activity.sections.forEach(checkSection)
      }
    }
  }

  if (pointsCount === 0)
    return null

  // Небольшой отступ (padding) 0.02 градуса (~2 км вокруг точек)
  const padding = 0.02

  return {
    minLng: Math.max(-180, minLng - padding),
    minLat: Math.max(-85, minLat - padding),
    maxLng: Math.min(180, maxLng + padding),
    maxLat: Math.min(85, maxLat + padding),
  }
}

/**
 * Получение списка тайлов для указанного bounding box на заданных зумах
 * Ограничено лимитом maxTiles во избежание перегрузки
 */
export function getTilesForBBox(
  bbox: BoundingBox,
  minZoom = 10,
  maxZoom = 15,
  maxTiles = 50000,
): { z: number, x: number, y: number }[] {
  const tiles: { z: number, x: number, y: number }[] = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const min = lngLatToTile(bbox.minLng, bbox.maxLat, z)
    const max = lngLatToTile(bbox.maxLng, bbox.minLat, z)

    const startX = Math.min(min.x, max.x)
    const endX = Math.max(min.x, max.x)
    const startY = Math.min(min.y, max.y)
    const endY = Math.max(min.y, max.y)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        if (tiles.length >= maxTiles)
          throw new Error('Область карты превышает лимит тайлов.')

        tiles.push({ z, x, y })
      }
    }
  }

  return tiles
}
