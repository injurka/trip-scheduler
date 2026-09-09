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

    // Google Maps daddr / saddr / destination / origin: lat,lon
    const destMatch = decoded.match(/[?&](?:daddr|saddr|destination|origin)=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (destMatch) {
      const lat = Number.parseFloat(destMatch[1])
      const lon = Number.parseFloat(destMatch[2])
      if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
        return [lon, lat]
      }
    }

    // Google Maps /search/lat,lon or /maps/dir/lat,lon
    const pathCoordsMatch = decoded.match(/(?:\/search\/|\/dir\/)(?:[^/]+\/)*([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (pathCoordsMatch) {
      const lat = Number.parseFloat(pathCoordsMatch[1])
      const lon = Number.parseFloat(pathCoordsMatch[2])
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

export function extractAllCoordinatesFromUrl(url: string): Array<[number, number]> {
  try {
    const decoded = decodeURIComponent(url)
    const results: Array<[number, number]> = []

    // 1. Google Maps /dir/lat1,lon1/lat2,lon2/...
    const dirSegments = decoded.match(/\/dir\/([^?#]+)/i)
    if (dirSegments) {
      const parts = dirSegments[1].split('/')
      for (const part of parts) {
        const coordMatch = part.match(/([-\d.]+)[,%2C\s]+([-\d.]+)/)
        if (coordMatch) {
          const lat = Number.parseFloat(coordMatch[1])
          const lon = Number.parseFloat(coordMatch[2])
          if (!Number.isNaN(lon) && !Number.isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
            results.push([lon, lat])
          }
        }
      }
      if (results.length > 0)
        return results
    }

    // 2. saddr and daddr in query
    const saddrMatch = decoded.match(/[?&]saddr=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    const daddrMatch = decoded.match(/[?&]daddr=([-\d.]+)[,%2C\s]+([-\d.]+)/i)
    if (saddrMatch && daddrMatch) {
      const sLat = Number.parseFloat(saddrMatch[1])
      const sLon = Number.parseFloat(saddrMatch[2])
      const dLat = Number.parseFloat(daddrMatch[1])
      const dLon = Number.parseFloat(daddrMatch[2])
      if (!Number.isNaN(sLon) && !Number.isNaN(sLat) && !Number.isNaN(dLon) && !Number.isNaN(dLat)) {
        return [[sLon, sLat], [dLon, dLat]]
      }
    }

    const single = extractCoordinatesFromUrl(url)
    if (single)
      return [single]
  }
  catch {
    // ignore decoding errors
  }
  return []
}

/**
 * Извлекает текстовые названия промежуточных точек (вейпоинтов) из ссылок Google Maps
 * вида /dir/Place1/Place2/... или origin=...&destination=...
 */
export function extractNamedWaypointsFromUrl(url: string): string[] {
  try {
    const decoded = decodeURIComponent(url)

    // 1. Google Maps /dir/Place1/Place2/...
    const dirSegments = decoded.match(/\/dir\/([^?#]+)/i)
    if (dirSegments) {
      const parts = dirSegments[1].split('/')
      const results: string[] = []
      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed || trimmed.startsWith('data=') || /^!/i.test(trimmed) || /^@/i.test(trimmed))
          continue
        const cleaned = trimmed.replace(/\+/g, ' ').trim()
        if (cleaned)
          results.push(cleaned)
      }
      if (results.length > 1)
        return results
    }

    // 2. origin and destination query parameters
    const originMatch = decoded.match(/[?&]origin=([^&]+)/i)
    const destMatch = decoded.match(/[?&]destination=([^&]+)/i)
    if (originMatch && destMatch) {
      const orig = originMatch[1].replace(/\+/g, ' ').trim()
      const dest = destMatch[1].replace(/\+/g, ' ').trim()
      if (orig && dest)
        return [orig, dest]
    }

    // 3. saddr and daddr non-coordinate place names
    const saddrMatch = decoded.match(/[?&]saddr=([^&]+)/i)
    const daddrMatch = decoded.match(/[?&]daddr=([^&]+)/i)
    if (saddrMatch && daddrMatch) {
      const s = saddrMatch[1].replace(/\+/g, ' ').trim()
      const d = daddrMatch[1].replace(/\+/g, ' ').trim()
      if (s && d)
        return [s, d]
    }
  }
  catch {
    // ignore
  }
  return []
}

export interface ExternalTrailLink {
  title: string
  url: string
  isBike: boolean
}

/**
 * Находит внешние ссылки на хайкинг/вело платформы (AllTrails, Hikingbook, Komoot, Wikiloc, Strava)
 * в строках активностей для сохранения в виде интерактивных карточек-заметок.
 */
export function extractExternalTrailLinks(text: string): ExternalTrailLink[] {
  const results: ExternalTrailLink[] = []
  const trailLineRegex = /^[ \t]*(?:[*-][ \t]*)?(?:_[^_\n]*(?:хайкинг|трек|trail|вело|велотрек|маршрут)[^_\n]*_|\*\*[^*\n]*(?:хайкинг|трек|trail|вело|велотрек|маршрут)[^*\n]*\*\*):[ \t]*(.*)$/gmi
  let match: RegExpExecArray | null
  while ((match = trailLineRegex.exec(text)) !== null) {
    const lineContent = match[1]
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRegex.exec(lineContent)) !== null) {
      const title = linkMatch[1].trim()
      const url = linkMatch[2].trim()
      const isBike = /вело|bike/i.test(match[0]) || /travelmode=bicycl|travelmode=bike|!3e1/i.test(url)
      if (/alltrails\.com|hikingbook\.net|komoot\.com|wikiloc\.com|strava\.com/i.test(url)) {
        results.push({
          title,
          url,
          isBike,
        })
      }
    }
  }
  return results
}

export interface ExtractedLocation {
  name: string
  query: string
  coordinates?: [number, number]
  isBike?: boolean
}

export function extractLocationsFromText(text: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = []

  const PREFIX_CLEAN_REGEX = /^(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|AllTrails|Hikingbook|Карты Yandex|Карты Google|Карты|Maps|Map|Трек|Маршрут|Велотрек|Веломаршрут):\s*/i

  function addLocation(name: string, query?: string, coords?: [number, number], isBike?: boolean) {
    const cleanName = name
      .replace(PREFIX_CLEAN_REGEX, '')
      .replace(/[[\]]/g, '')
      .trim()
    const cleanQuery = (query || cleanName)
      .replace(PREFIX_CLEAN_REGEX, '')
      .replace(/[[\]]/g, '')
      .trim()

    if (!cleanName && !cleanQuery)
      return

    const existing = locations.find(l => (cleanName && l.name.toLowerCase() === cleanName.toLowerCase()))
    if (existing) {
      if (!existing.coordinates && coords)
        existing.coordinates = coords
      if (isBike)
        existing.isBike = true
    }
    else {
      locations.push({
        name: cleanName || cleanQuery,
        query: cleanQuery || cleanName,
        coordinates: coords,
        isBike,
      })
    }
  }

  // 1. Process explicit location lines (e.g. _Ссылка на локацию_:, _Локация_:, _Хайкинг-трек_:, _Велотрек_:)
  const locLineRegex = /^[ \t]*(?:[*-][ \t]*)?(?:_[^_\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^_\n]*_|\*\*[^*\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^*\n]*\*\*):[ \t]*(.*)$/gmi
  let locLineMatch: RegExpExecArray | null
  while ((locLineMatch = locLineRegex.exec(text)) !== null) {
    const lineContent = locLineMatch[1]
    const isLineBike = /вело|bike/i.test(locLineMatch[0])

    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    let linkMatch: RegExpExecArray | null
    let foundLink = false
    while ((linkMatch = linkRegex.exec(lineContent)) !== null) {
      foundLink = true
      const linkTitle = linkMatch[1]
      const linkUrl = linkMatch[2]
      const isBike = isLineBike || /travelmode=bicycl|travelmode=bike|!3e1/i.test(linkUrl)

      let locationName = linkTitle
      const stripped = linkTitle.replace(PREFIX_CLEAN_REGEX, '').trim()
      if (stripped && !/^(?:Google Maps|Yandex Maps|2GIS|OpenStreetMap|AllTrails|Hikingbook|Карты|Maps|Ссылка|Локация|Маршрут|Трек|Велотрек|Веломаршрут)$/i.test(stripped)) {
        locationName = stripped
      }
      else {
        try {
          const decoded = decodeURIComponent(linkUrl)
          const qMatch = decoded.match(/[?&]q=(?:loc:)?([^&]+)/i)
          if (qMatch && qMatch[1].trim()) {
            const qVal = qMatch[1].replace(/\+/g, ' ').trim()
            if (qVal && !/^[-\d.,\s]+$/.test(qVal)) {
              locationName = qVal
            }
          }
        }
        catch {
          // ignore
        }
      }

      // 1. Check for coordinate-based route points in URL
      const allCoords = extractAllCoordinatesFromUrl(linkUrl)
      if (allCoords.length > 1) {
        allCoords.forEach((coords, idx) => {
          const ptName = `${locationName} (Точка ${idx + 1})`
          addLocation(ptName, ptName, coords, isBike)
        })
      }
      else {
        // 2. Check for named-place route (e.g. Google Maps /dir/Place1/Place2)
        const namedWaypoints = extractNamedWaypointsFromUrl(linkUrl)
        if (namedWaypoints.length > 1) {
          namedWaypoints.forEach((placeName, idx) => {
            const ptName = `${locationName} (Точка ${idx + 1})`
            addLocation(ptName, placeName, undefined, isBike)
          })
        }
        else {
          const coords = allCoords.length === 1 ? allCoords[0] : extractCoordinatesFromUrl(linkUrl)
          addLocation(locationName, locationName, coords, isBike)
        }
      }
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
        addLocation('Локация на карте', 'Локация на карте', coords, isLineBike)
      }
    }

    if (!foundLink && !lineContent.includes('<iframe')) {
      const plain = lineContent.replace(/<[^>]+>/g, '').trim()
      if (plain)
        addLocation(plain, plain, undefined, isLineBike)
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
  const standaloneMapLinkRegex = /\[((?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|AllTrails|Hikingbook|Карты|Maps|Трек|Маршрут|Велотрек|Веломаршрут)[^\]]+)\]\((https?:\/\/[^)]+)\)/gi
  let stdMapLinkMatch: RegExpExecArray | null
  while ((stdMapLinkMatch = standaloneMapLinkRegex.exec(text)) !== null) {
    const title = stdMapLinkMatch[1]
    const url = stdMapLinkMatch[2]
    const isBike = /вело|bike/i.test(title) || /travelmode=bicycl|travelmode=bike|!3e1/i.test(url)
    const allCoords = extractAllCoordinatesFromUrl(url)
    if (allCoords.length > 1) {
      allCoords.forEach((coords, idx) => {
        const ptName = `${title} (Точка ${idx + 1})`
        addLocation(ptName, ptName, coords, isBike)
      })
    }
    else {
      const namedWaypoints = extractNamedWaypointsFromUrl(url)
      if (namedWaypoints.length > 1) {
        namedWaypoints.forEach((placeName, idx) => {
          const ptName = `${title} (Точка ${idx + 1})`
          addLocation(ptName, placeName, undefined, isBike)
        })
      }
      else {
        const coords = allCoords.length === 1 ? allCoords[0] : extractCoordinatesFromUrl(url)
        addLocation(title, title, coords, isBike)
      }
    }
  }

  return locations
}
