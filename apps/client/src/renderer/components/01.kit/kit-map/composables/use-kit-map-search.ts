import { ref } from 'vue'
import { nominatimService } from '~/shared/services/geo'

export interface MapSearchResult {
  lat: number
  lon: number
  displayName: string
  boundingbox?: string[]
}

export function useKitMapSearch() {
  const isSearching = ref(false)

  /**
   * Ищет локацию через единый сервис Nominatim
   * @param query Строка поиска (адрес, название места)
   * @returns Координаты и название, либо null, если ничего не найдено
   */
  async function searchLocation(query: string): Promise<MapSearchResult | null> {
    if (!query.trim())
      return null

    isSearching.value = true
    try {
      const result = await nominatimService.searchSingle(query)
      if (result) {
        return {
          lat: result.lat,
          lon: result.lon,
          displayName: result.displayName,
          boundingbox: result.boundingbox,
        }
      }
      return null
    }
    catch (e) {
      console.error('[useKitMapSearch] Ошибка поиска:', e)
      return null
    }
    finally {
      isSearching.value = false
    }
  }

  return {
    isSearching,
    searchLocation,
  }
}
