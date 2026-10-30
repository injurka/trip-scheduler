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

interface OsrmRouteResponse {
  code?: string
  routes?: Array<{
    geometry: string
    distance: number
    duration: number
  }>
}

const OSRM_ENDPOINTS: Record<string, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bicycle',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
}

const MAX_ROUTE_CACHE_ENTRIES = 150

class RoutingService {
  private routeCache = new Map<string, CalculatedRoute>()
  private activeControllers = new Map<string, AbortController>()

  private setWithLimit<K, V>(
    map: Map<K, V>,
    key: K,
    value: V,
    limit: number,
  ): void {
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

  private abortRouteRequest(routeId?: string): void {
    if (!routeId)
      return

    this.activeControllers.get(routeId)?.abort()
    this.activeControllers.delete(routeId)
  }

  private createRouteSignal(routeId?: string): AbortSignal | undefined {
    if (!routeId)
      return undefined

    const controller = new AbortController()
    this.activeControllers.set(routeId, controller)

    return controller.signal
  }

  private clearRouteRequest(routeId: string | undefined, signal: AbortSignal | undefined): void {
    if (routeId && this.activeControllers.get(routeId)?.signal === signal)
      this.activeControllers.delete(routeId)
  }

  private getRouteUrl(coords: [number, number][], mode: RoutingTransportMode): string {
    const endpoint = OSRM_ENDPOINTS[mode] || OSRM_ENDPOINTS.foot
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';')

    return `${endpoint}/${coordsString}?overview=full&geometries=polyline&steps=false`
  }

  private async fetchRoute(url: string, signal: AbortSignal | undefined): Promise<OsrmRouteResponse> {
    const response = await fetch(url, { signal })

    if (!response.ok)
      return {}

    return await response.json() as OsrmRouteResponse
  }

  private createCalculatedRoute(route: NonNullable<OsrmRouteResponse['routes']>[number]): CalculatedRoute {
    const decodedGeometry = Polyline.decode(route.geometry).map(([lat, lon]) => [lon, lat]) as [number, number][]

    return {
      geometry: decodedGeometry,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      isDirect: false,
    }
  }

  private async fetchAndCacheRoute(
    url: string,
    coords: [number, number][],
    mode: RoutingTransportMode,
    cacheKey: string,
    signal: AbortSignal | undefined,
  ): Promise<CalculatedRoute> {
    try {
      const data = await this.fetchRoute(url, signal)
      const route = data.routes?.[0]

      if (data.code !== 'Ok' || !route)
        return this.createDirectFallback(coords, mode)

      const result = this.createCalculatedRoute(route)
      this.setWithLimit(
        this.routeCache,
        cacheKey,
        result,
        MAX_ROUTE_CACHE_ENTRIES,
      )

      return result
    }
    catch (error: any) {
      if (error?.name === 'AbortError')
        throw error

      console.warn('[RoutingService] Fallback to direct path:', error)

      return this.createDirectFallback(coords, mode)
    }
  }

  /**
   * Расчет маршрута между точками с защитой от race conditions и отравления кэша
   */
  async calculateRoute(waypoints: WaypointInput[], mode: RoutingTransportMode = 'foot', routeId?: string): Promise<CalculatedRoute> {
    const coords = waypoints.map(w => this.normalizeCoords(w))

    if (coords.length < 2) {
      return {
        geometry: coords,
        distance: 0,
        duration: 0,
        isDirect: true,
      }
    }

    this.abortRouteRequest(routeId)

    // No timetable provider: preserve waypoints without inventing a bus route or ETA.
    if (mode === 'transit')
      return { geometry: coords, distance: 0, duration: 0, isDirect: true }

    const cacheKey = this.getCacheKey(coords, mode)
    const cached = this.routeCache.get(cacheKey)

    if (cached) {
      return {
        ...cached,
        geometry: [...cached.geometry],
      }
    }

    const signal = this.createRouteSignal(routeId)
    const url = this.getRouteUrl(coords, mode)

    try {
      return await this.fetchAndCacheRoute(
        url,
        coords,
        mode,
        cacheKey,
        signal,
      )
    }
    finally {
      this.clearRouteRequest(routeId, signal)
    }
  }

  private calculateHaversineDistance(c1: [number, number], c2: [number, number]): number {
    const R = 6371000 // meters
    const dLat = (c2[1] - c1[1]) * (Math.PI / 180)
    const dLon = (c2[0] - c1[0]) * (Math.PI / 180)
    const lat1 = c1[1] * (Math.PI / 180)
    const lat2 = c2[1] * (Math.PI / 180)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1) * Math.cos(lat2)
      * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  private createDirectFallback(coords: [number, number][], mode: RoutingTransportMode): CalculatedRoute {
    let distance = 0

    for (let i = 0; i < coords.length - 1; i++) {
      distance += this.calculateHaversineDistance(coords[i], coords[i + 1])
    }

    const roundedDistance = Math.round(distance)
    // Оценка пешего времени: ~4.5 км/ч (1.25 м/с)
    const duration = mode === 'foot' || mode === 'walk' ? Math.round(roundedDistance / 1.25) : 0

    return {
      geometry: coords,
      distance: roundedDistance,
      duration,
      isDirect: true,
    }
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
