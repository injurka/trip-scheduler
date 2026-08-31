export function extractCoordinatesFromUrl(url: string): [number, number] | undefined {
  try {
    const decoded = decodeURIComponent(url)

    // Yandex ll=lon,lat or ll=lon%2Clat or pt=lon,lat
    const yandexLl = decoded.match(/[?&](?:ll|pt)=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (yandexLl) {
      const lon = Number.parseFloat(yandexLl[1])
      const lat = Number.parseFloat(yandexLl[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Google Maps / OSM @lat,lon
    const atMatch = decoded.match(/@([-\d.]+)[,%2C\s]+([-\d.]+)/)
    if (atMatch) {
      const lat = Number.parseFloat(atMatch[1])
      const lon = Number.parseFloat(atMatch[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Google Maps q=lat,lon or maps?q=lat,lon
    const googleQ = decoded.match(/[?&]q=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (googleQ) {
      const lat = Number.parseFloat(googleQ[1])
      const lon = Number.parseFloat(googleQ[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }
  }
  catch {
    // ignore decoding errors
  }
  return undefined
}

export function extractLocationsFromText(text: string): Array<{ name: string, query: string, coordinates?: [number, number] }> {
  const locations: Array<{ name: string, query: string, coordinates?: [number, number] }> = []

  function addLocation(name: string, query?: string, coords?: [number, number]) {
    const cleanName = name
      .replace(/^(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|Карты Yandex|Карты Google|Карты|Maps|Map):\s*/i, '')
      .replace(/[[\]]/g, '')
      .trim()
    const cleanQuery = (query || cleanName).trim()

    if (!cleanName && !cleanQuery)
      return

    const existing = locations.find(l => (cleanName && l.name.toLowerCase() === cleanName.toLowerCase()))
    if (existing) {
      if (!existing.coordinates && coords)
        existing.coordinates = coords
    }
    else {
      locations.push({
        name: cleanName || cleanQuery,
        query: cleanQuery || cleanName,
        coordinates: coords,
      })
    }
  }

  // 1. Process explicit "_Ссылка на локацию_:" lines
  const locLineRegex = /^[ \t]*(?:[*-][ \t]*)?_[Сс]сылка на локацию_:[ \t]*(.*)$/gm
  let locLineMatch: RegExpExecArray | null
  while ((locLineMatch = locLineRegex.exec(text)) !== null) {
    const lineContent = locLineMatch[1]

    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    let linkMatch: RegExpExecArray | null
    let foundLink = false
    while ((linkMatch = linkRegex.exec(lineContent)) !== null) {
      foundLink = true
      const linkTitle = linkMatch[1]
      const linkUrl = linkMatch[2]
      const coords = extractCoordinatesFromUrl(linkUrl)
      addLocation(linkTitle, linkTitle, coords)
    }

    const iframeRegex = /<iframe[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi
    let iframeMatch: RegExpExecArray | null
    while ((iframeMatch = iframeRegex.exec(lineContent)) !== null) {
      const iframeSrc = iframeMatch[1]
      const coords = extractCoordinatesFromUrl(iframeSrc)
      if (coords && locations.length > 0 && !locations[locations.length - 1].coordinates) {
        locations[locations.length - 1].coordinates = coords
      }
    }

    if (!foundLink && !lineContent.includes('<iframe')) {
      const plain = lineContent.replace(/<[^>]+>/g, '').trim()
      if (plain)
        addLocation(plain, plain)
    }
  }

  // 2. Standalone iframes in text
  const standaloneIframeRegex = /<iframe[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi
  let stdIframeMatch: RegExpExecArray | null
  while ((stdIframeMatch = standaloneIframeRegex.exec(text)) !== null) {
    const src = stdIframeMatch[1]
    const coords = extractCoordinatesFromUrl(src)
    if (coords && locations.length > 0 && !locations[locations.length - 1].coordinates) {
      locations[locations.length - 1].coordinates = coords
    }
  }

  // 3. Standalone map markdown links in text
  const standaloneMapLinkRegex = /\[((?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|Карты|Maps)[^\]]+)\]\((https?:\/\/[^)]+)\)/gi
  let stdMapLinkMatch: RegExpExecArray | null
  while ((stdMapLinkMatch = standaloneMapLinkRegex.exec(text)) !== null) {
    const title = stdMapLinkMatch[1]
    const url = stdMapLinkMatch[2]
    const coords = extractCoordinatesFromUrl(url)
    addLocation(title, title, coords)
  }

  return locations
}
