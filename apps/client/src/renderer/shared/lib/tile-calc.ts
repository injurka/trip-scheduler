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
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom,
  )
  const maxTile = 2 ** zoom - 1
  return {
    x: Math.max(0, Math.min(maxTile, x)),
    y: Math.max(0, Math.min(maxTile, y)),
  }
}

/**
 * Расчет BoundingBox по точкам гео-секций, активностей и треков
 */
export function calculateTripBoundingBox(trip: any): BoundingBox | null {
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

  const checkSection = (sec: any) => {
    if (!sec)
      return
    const target = sec.content || sec

    if (Array.isArray(target.points)) {
      target.points.forEach((p: any) => {
        if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
          addPoint(p.coordinates[0], p.coordinates[1])
        }
      })
    }

    if (Array.isArray(target.routes)) {
      target.routes.forEach((r: any) => {
        if (Array.isArray(r.points)) {
          r.points.forEach((p: any) => {
            if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
              addPoint(p.coordinates[0], p.coordinates[1])
            }
          })
        }
        if (Array.isArray(r.geometry)) {
          r.geometry.forEach((coord: any) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              addPoint(coord[0], coord[1])
            }
          })
        }
      })
    }

    if (Array.isArray(target.center) && target.center.length >= 2) {
      addPoint(target.center[0], target.center[1])
    }
  }

  // Обход секций путешествия
  trip.sections?.forEach(checkSection)

  // Обход дней и активностей
  trip.days?.forEach((day: any) => {
    day.activities?.forEach((act: any) => {
      act.sections?.forEach(checkSection)
    })
  })

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
  maxTiles = 450,
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
        tiles.push({ z, x, y })
        if (tiles.length >= maxTiles) {
          return tiles
        }
      }
    }
  }

  return tiles
}
