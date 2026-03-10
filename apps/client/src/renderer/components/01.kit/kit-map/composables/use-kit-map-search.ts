import { ref } from 'vue'

export interface MapSearchResult {
  lat: number
  lon: number
  displayName: string
  boundingbox?: string[]
}

export function useKitMapSearch() {
  const isSearching = ref(false)

  /**
   * Ищет локацию через API Nominatim (OpenStreetMap)
   * @param query Строка поиска (адрес, название места)
   * @returns Координаты и название, либо null, если ничего не найдено
   */
  async function searchLocation(query: string): Promise<MapSearchResult | null> {
    if (!query.trim())
      return null

    isSearching.value = true
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=ru`

      const res = await fetch(url)

      if (!res.ok) {
        throw new Error(`Ошибка HTTP: ${res.status}`)
      }

      const data = await res.json()

      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        return {
          lat: Number.parseFloat(data[0].lat),
          lon: Number.parseFloat(data[0].lon),
          displayName: data[0].display_name,
          boundingbox: data[0].boundingbox,
        }
      }

      return null
    }
    catch (e) {
      console.error('[useMapSearch] Ошибка запроса к Nominatim:', e)
      throw e
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
