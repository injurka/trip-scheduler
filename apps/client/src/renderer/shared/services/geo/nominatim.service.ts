export interface GeoSearchResult {
  lat: number
  lon: number
  displayName: string
  address?: Record<string, string>
  boundingbox?: string[]
}

export interface GeoAddressResult {
  coordinates: [number, number]
  address: string
  rawAddress?: Record<string, string>
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const MAX_SEARCH_CACHE_ENTRIES = 100
const MAX_REVERSE_CACHE_ENTRIES = 300

class NominatimService {
  private searchCache = new Map<string, GeoSearchResult[]>()
  private reverseCache = new Map<string, GeoAddressResult>()

  private setWithLimit<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
    if (map.size >= limit) {
      const oldestKey = map.keys().next().value
      if (oldestKey !== undefined) {
        map.delete(oldestKey)
      }
    }
    map.set(key, value)
  }

  private getCoordKey(lon: number, lat: number): string {
    return `${lon.toFixed(5)},${lat.toFixed(5)}`
  }

  /**
   * Поиск локаций по текстовому запросу
   */
  async search(query: string, limit: number = 5, lang: string = 'ru'): Promise<GeoSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed)
      return []

    const cacheKey = `${lang}::${limit}::${trimmed.toLowerCase()}`
    const cached = this.searchCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&format=json&limit=${limit}&addressdetails=1&accept-language=${lang}`
      const res = await fetch(url)
      if (!res.ok) {
        return []
      }

      const data = await res.json()
      if (!Array.isArray(data)) {
        return []
      }

      const results: GeoSearchResult[] = data.map(item => ({
        lat: Number.parseFloat(item.lat),
        lon: Number.parseFloat(item.lon),
        displayName: item.display_name || '',
        address: item.address,
        boundingbox: item.boundingbox,
      })).filter(item => !Number.isNaN(item.lat) && !Number.isNaN(item.lon))

      this.setWithLimit(this.searchCache, cacheKey, results, MAX_SEARCH_CACHE_ENTRIES)
      return results
    }
    catch (err) {
      console.error('[NominatimService] Ошибка поиска:', err)
      return []
    }
  }

  /**
   * Обратное геокодирование: получение адреса по координатам [lon, lat]
   */
  async reverse(coordinates: [number, number], lang: string = 'ru'): Promise<GeoAddressResult | null> {
    const [lon, lat] = coordinates
    if (Number.isNaN(lon) || Number.isNaN(lat)) {
      return null
    }

    const cacheKey = `${lang}::${this.getCoordKey(lon, lat)}`
    const cached = this.reverseCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const url = `${NOMINATIM_REVERSE_URL}?format=json&lon=${lon}&lat=${lat}&addressdetails=1&accept-language=${lang}`
      const res = await fetch(url)
      if (!res.ok) {
        return null
      }

      const data = await res.json()
      if (data.error) {
        return null
      }

      let formattedAddress = data.display_name || 'Адрес не найден'
      if (data.address) {
        const road = data.address.road || data.address.pedestrian || data.address.footway || ''
        const houseNumber = data.address.house_number || ''
        if (road) {
          formattedAddress = houseNumber ? `${road}, ${houseNumber}` : road
        }
      }

      const result: GeoAddressResult = {
        coordinates: [lon, lat],
        address: formattedAddress,
        rawAddress: data.address,
      }

      this.setWithLimit(this.reverseCache, cacheKey, result, MAX_REVERSE_CACHE_ENTRIES)
      return result
    }
    catch (err) {
      console.error('[NominatimService] Ошибка обратного геокодирования:', err)
      return null
    }
  }

  /**
   * Быстрый поиск одной лучшей локации
   */
  async searchSingle(query: string, lang: string = 'ru'): Promise<GeoSearchResult | null> {
    const results = await this.search(query, 1, lang)
    return results[0] || null
  }
}

export const nominatimService = new NominatimService()
