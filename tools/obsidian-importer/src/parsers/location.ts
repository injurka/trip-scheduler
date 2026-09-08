export function extractCoordinatesFromUrl(url: string): [number, number] | undefined {
  try {
    const decoded = decodeURIComponent(url)

    // Google Maps place data !3d<lat>!4d<lon>
    const gPlaceMatch = decoded.match(/!3d([-\d.]+)!4d([-\d.]+)/i)
    if (gPlaceMatch) {
      const lat = Number.parseFloat(gPlaceMatch[1])
      const lon = Number.parseFloat(gPlaceMatch[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Google Maps embed protobuf !2d<lon>!3d<lat>
    const pbMatch = decoded.match(/!2d([-\d.]+)!3d([-\d.]+)/i)
    if (pbMatch) {
      const lon = Number.parseFloat(pbMatch[1])
      const lat = Number.parseFloat(pbMatch[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Yandex vs Apple ll
    const isApple = /maps\.apple\.com/i.test(decoded)
    const llMatch = decoded.match(/[?&](?:ll|pt)=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (llMatch) {
      const v1 = Number.parseFloat(llMatch[1])
      const v2 = Number.parseFloat(llMatch[2])
      if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
        // Apple Maps ll is lat,lon; Yandex ll is lon,lat
        const lon = isApple ? v2 : v1
        const lat = isApple ? v1 : v2
        if (Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
          return [lon, lat]
        }
      }
    }

    // Google Maps / OSM / 2GIS @lat,lon
    const atMatch = decoded.match(/@([-\d.]+)[,%2C\s]+([-\d.]+)/)
    if (atMatch) {
      const lat = Number.parseFloat(atMatch[1])
      const lon = Number.parseFloat(atMatch[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Google Maps q=lat,lon or q=loc:lat,lon or maps?q=lat,lon
    const googleQ = decoded.match(/[?&]q=(?:loc:)?([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (googleQ) {
      const lat = Number.parseFloat(googleQ[1])
      const lon = Number.parseFloat(googleQ[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // OpenStreetMap mlat=lat&mlon=lon or #map=zoom/lat/lon
    const osmMlat = decoded.match(/[?&]mlat=([-\d.]+)[&]mlon=([-\d.]+)/i)
    if (osmMlat) {
      const lat = Number.parseFloat(osmMlat[1])
      const lon = Number.parseFloat(osmMlat[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    const osmHash = decoded.match(/#map=\d+\/([-\d.]+)\/([-\d.]+)/i)
    if (osmHash) {
      const lat = Number.parseFloat(osmHash[1])
      const lon = Number.parseFloat(osmHash[2])
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

  // 1. Process explicit location lines (e.g. _Ссылка на локацию_:, _Локация_:, **Карта**:)
  const locLineRegex = /^[ \t]*(?:[*-][ \t]*)?(?:_[^_\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка)[^_\n]*_|\*\*[^*\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка)[^*\n]*\*\*):[ \t]*(.*)$/gmi
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
      else if (coords && locations.length === 0) {
        // Standalone iframe inside location line with coords but no link
        addLocation('Локация на карте', 'Локация на карте', coords)
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
    else if (coords && locations.length === 0) {
      addLocation('Локация на карте', 'Локация на карте', coords)
    }
    else if (!coords) {
      // Try to extract query parameter from iframe if present
      try {
        const decoded = decodeURIComponent(src)
        const qMatch = decoded.match(/[?&]q=([^&]+)/i)
        if (qMatch && qMatch[1].trim()) {
          const qVal = qMatch[1].replace(/\+/g, ' ').trim()
          if (qVal && !/^[-\d.,\s]+$/.test(qVal)) {
            addLocation(qVal, qVal)
          }
        }
      }
      catch {
        // ignore
      }
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
