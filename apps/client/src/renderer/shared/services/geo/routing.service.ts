import Polyline from '@mapbox/polyline'

export type RoutingTransportMode = 'foot' | 'bike' | 'car' | 'walk' | 'transit'

export interface CalculatedRoute {
  geometry: [number, number][]
  distance: number // meters
  duration: number // seconds
  isDirect: boolean
  elevationGain?: number
  elevationLoss?: number
}

export type WaypointInput = [number, number] | { coordinates: [number, number] }

const OSRM_ENDPOINTS: Record<string, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bicycle',
  transit: 'https://routing.openstreetmap.de/routed-bike/route/v1/bicycle',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
}

const MAX_ROUTE_CACHE_ENTRIES = 150

class RoutingService {
  private routeCache = new Map<string, CalculatedRoute>()

  private setWithLimit<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
    if (map.size >= limit) {
      const oldestKey = map.keys().next().value
      if (oldestKey !== undefined) {
        map.delete(oldestKey)
      }
    }
    map.set(key, value)
  }

  private normalizeCoords(waypoint: WaypointInput): [number, number] {
    if (Array.isArray(waypoint)) {
      return [waypoint[0], waypoint[1]]
    }
    return [waypoint.coordinates[0], waypoint.coordinates[1]]
  }

  private getCacheKey(coords: [number, number][], mode: RoutingTransportMode): string {
    const coordsStr = coords.map(c => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join(';')
    return `${mode}::${coordsStr}`
  }

  /**
   * Расчет маршрута между точками
   */
  async calculateRoute(
    waypoints: WaypointInput[],
    mode: RoutingTransportMode = 'foot',
  ): Promise<CalculatedRoute> {
    const coords = waypoints.map(w => this.normalizeCoords(w))
    if (coords.length < 2) {
      return {
        geometry: coords,
        distance: 0,
        duration: 0,
        isDirect: true,
      }
    }

    const cacheKey = this.getCacheKey(coords, mode)
    const cached = this.routeCache.get(cacheKey)
    if (cached) {
      return {
        ...cached,
        geometry: [...cached.geometry],
      }
    }

    const endpoint = OSRM_ENDPOINTS[mode] || OSRM_ENDPOINTS.foot
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';')
    const url = `${endpoint}/${coordsString}?overview=full&geometries=polyline&steps=false`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        return this.createFallback(coords, cacheKey)
      }

      const data = await response.json()
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return this.createFallback(coords, cacheKey)
      }

      const route = data.routes[0]
      const decodedGeometry = Polyline.decode(route.geometry).map(
        ([lat, lon]: [number, number]) => [lon, lat],
      ) as [number, number][]

      const result: CalculatedRoute = {
        geometry: decodedGeometry,
        distance: Math.round(route.distance),
        duration: Math.round(route.duration),
        isDirect: false,
      }

      this.setWithLimit(this.routeCache, cacheKey, result, MAX_ROUTE_CACHE_ENTRIES)
      return result
    }
    catch (error) {
      console.error('[RoutingService] Ошибка при запросе маршрута:', error)
      return this.createFallback(coords, cacheKey)
    }
  }

  private createFallback(coords: [number, number][], cacheKey: string): CalculatedRoute {
    const fallback: CalculatedRoute = {
      geometry: coords,
      distance: 0,
      duration: 0,
      isDirect: true,
    }
    this.setWithLimit(this.routeCache, cacheKey, fallback, MAX_ROUTE_CACHE_ENTRIES)
    return fallback
  }

  /**
   * Форматирование расстояния (метры / километры)
   */
  formatDistance(meters: number): string {
    if (!meters || meters <= 0)
      return '0 м'
    if (meters < 1000) {
      return `${Math.round(meters)} м`
    }
    const km = meters / 1000
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} км`
  }

  /**
   * Форматирование длительности (секунды в часы/минуты)
   */
  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0)
      return '0 мин'
    const totalMinutes = Math.round(seconds / 60)
    if (totalMinutes < 60) {
      return `${totalMinutes} мин`
    }
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`
  }
}

export const routingService = new RoutingService()
