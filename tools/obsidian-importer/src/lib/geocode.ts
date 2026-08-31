export async function geocodeLocation(
  locationQuery: string,
  geoCache: Map<string, [number, number]>,
  locationContext?: string,
): Promise<[number, number] | null> {
  const cleanQuery = locationQuery
    .replace(/^https?:\/\/\S+/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|Карты Yandex|Карты Google|Карты|Maps|Map):\s*/i, '')
    .replace(/[[\]()*_]/g, '')
    .trim()

  if (!cleanQuery || cleanQuery.length < 2) {
    return null
  }

  const cacheKey = `${cleanQuery}__${locationContext || ''}`
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!
  }

  // 1. Try Photon Komoot API
  try {
    const fullQuery = locationContext && !cleanQuery.includes(locationContext)
      ? `${cleanQuery}, ${locationContext}`
      : cleanQuery

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'TripScheduler-Importer/1.0' } })
    if (res.ok) {
      const data = (await res.json()) as any
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates as [number, number]
        geoCache.set(cacheKey, coords)
        return coords
      }
    }
  }
  catch {
    // ignore
  }

  // 2. Fallback to OSM Nominatim
  try {
    const fullQuery = locationContext && !cleanQuery.includes(locationContext)
      ? `${cleanQuery}, ${locationContext}`
      : cleanQuery

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'TripScheduler-Importer/1.0' } })
    if (res.ok) {
      const data = (await res.json()) as any
      if (Array.isArray(data) && data.length > 0) {
        const lon = Number.parseFloat(data[0].lon)
        const lat = Number.parseFloat(data[0].lat)
        if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
          const coords: [number, number] = [lon, lat]
          geoCache.set(cacheKey, coords)
          return coords
        }
      }
    }
  }
  catch {
    // ignore
  }

  return null
}
