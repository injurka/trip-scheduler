import type {
  ActivityPayload,
  ActivitySection,
  ActivitySectionDescription,
  ActivitySectionGeolocation,
  Booking,
  GeolocationPoint,
} from '../types'
import type { ImageCacheEntry } from './cache'
import type { MetroActivityResolver } from './metro-resolver'
import { colors } from '../config/colors'
import { dedentText } from '../parsers/activity'
import { extractGalleryBlocks } from '../parsers/gallery'
import { extractGpxReferences, parseGpxFile, resolveGpxFile } from '../parsers/gpx'
import { extractExternalTrailLinks, extractLabeledRouteMode, extractLocationsFromText, extractRouteTransportMode } from '../parsers/location'
import { pMap } from './concurrency'
import { geocodeLocation } from './geocode'
import { resolveImageFromIndex, uploadSingleImage } from './image-uploader'
import { stableId } from './stable-id'

interface ImageUploader {
  uploadImage: (tripId: string, filePath: string, placement?: 'route' | 'memories' | 'notes' | 'documents') => Promise<string>
}

function getHotelActivityKind(title: string): 'check-in' | 'return' | null {
  const hasHotelDestination = /(?:^|\s)(?:в|к)\s+(?:(?:этот|наш|свой|транзитн\p{L}*|назначенн\p{L}*|выбранн\p{L}*)\s+)*(?:отел\p{L}*|гостиниц\p{L}*|hotel|hostel)(?=$|[\s:,.!?()])|(?:^|\s)(?:to|at)\s+(?:the\s+)?(?:hotel|hostel)(?=$|[\s:,.!?()])/iu.test(title)
  if (!hasHotelDestination)
    return null

  if (/(?:засел\p{L}*|заезд\p{L}*|check[\s-]?in|checking\s+in)/iu.test(title))
    return 'check-in'
  if (/(?:возвращ\p{L}*|возврат\p{L}*|return(?:ing)?|back\s+to)/iu.test(title))
    return 'return'

  return null
}

function matchesHotelBookingActivity(title: string, hotelName: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const normalizedTitle = normalize(title)
  const normalizedHotelName = normalize(hotelName)
  const brandName = normalize(hotelName.toLowerCase().split(/(?:^|\s)(?:hotel|hostel|villa|inn|b&b|boutique|resort|отел\p{L}*|гостиниц\p{L}*)/iu, 1)[0])
  const shortName = normalize(hotelName.toLowerCase().replace(/(?:^|\s)(?:hotel|hostel|villa|inn|b&b|boutique|resort|отел\p{L}*|гостиниц\p{L}*)/giu, ' '))

  return [normalizedHotelName, brandName, shortName]
    .some(alias => alias.length >= 4 && normalizedTitle.includes(alias))
}

function computeGeoBoundsAndCenter(
  points: Array<{ coordinates?: [number, number] }>,
  routes: Array<{ points?: Array<{ coordinates?: [number, number] }>, geometry?: [number, number][] }>,
): { center: [number, number], zoom: number } | null {
  const allCoords: [number, number][] = []

  points.forEach((p) => {
    if (p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length === 2 && !Number.isNaN(p.coordinates[0]) && !Number.isNaN(p.coordinates[1])) {
      allCoords.push(p.coordinates)
    }
  })

  routes.forEach((r) => {
    if (Array.isArray(r.geometry) && r.geometry.length > 0) {
      r.geometry.forEach((c) => {
        if (Array.isArray(c) && c.length === 2 && !Number.isNaN(c[0]) && !Number.isNaN(c[1])) {
          allCoords.push(c)
        }
      })
    }
    else if (Array.isArray(r.points)) {
      r.points.forEach((p) => {
        if (p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length === 2 && !Number.isNaN(p.coordinates[0]) && !Number.isNaN(p.coordinates[1])) {
          allCoords.push(p.coordinates)
        }
      })
    }
  })

  if (allCoords.length === 0)
    return null

  let minLng = allCoords[0][0]
  let maxLng = allCoords[0][0]
  let minLat = allCoords[0][1]
  let maxLat = allCoords[0][1]

  for (let i = 1; i < allCoords.length; i++) {
    const [lng, lat] = allCoords[i]
    if (lng < minLng)
      minLng = lng
    if (lng > maxLng)
      maxLng = lng
    if (lat < minLat)
      minLat = lat
    if (lat > maxLat)
      maxLat = lat
  }

  const center: [number, number] = [
    (minLng + maxLng) / 2,
    (minLat + maxLat) / 2,
  ]

  if (minLng === maxLng && minLat === maxLat) {
    return { center, zoom: 13.5 }
  }

  const dLat = ((maxLat - minLat) * Math.PI) / 180
  const dLng = ((maxLng - minLng) * Math.PI) / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos((minLat * Math.PI) / 180) * Math.cos((maxLat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = 6371 * c

  let zoom = 12
  if (distanceKm <= 0.6) {
    zoom = 14.8
  }
  else if (distanceKm <= 1.2) {
    zoom = 13.8
  }
  else if (distanceKm <= 3.5) {
    zoom = 12.8
  }
  else if (distanceKm <= 10) {
    zoom = 11
  }
  else if (distanceKm <= 25) {
    zoom = 10
  }
  else if (distanceKm <= 60) {
    zoom = 9
  }
  else if (distanceKm <= 150) {
    zoom = 8
  }
  else if (distanceKm <= 400) {
    zoom = 7
  }
  else {
    zoom = 5
  }

  return { center, zoom }
}

const CALLOUT_META_MAP: Record<string, { defaultTitle: string, icon: string, color: string }> = {
  TIP: { defaultTitle: 'Совет', icon: 'mdi:lightbulb-outline', color: '#A3D9A5' },
  INFO: { defaultTitle: 'Информация', icon: 'mdi:information-outline', color: '#9BF6FF' },
  NOTE: { defaultTitle: 'Заметка', icon: 'mdi:note-text-outline', color: '#FDFFB6' },
  IMPORTANT: { defaultTitle: 'Важно', icon: 'mdi:alert-circle-outline', color: '#FFD6A5' },
  WARNING: { defaultTitle: 'Внимание', icon: 'mdi:alert-outline', color: '#FFADAD' },
  CAUTION: { defaultTitle: 'Осторожно', icon: 'mdi:alert-octagon-outline', color: '#FFADAD' },
  FAQ: { defaultTitle: 'Вопрос-ответ', icon: 'mdi:help-circle-outline', color: '#A0C4FF' },
  QUESTION: { defaultTitle: 'Вопрос-ответ', icon: 'mdi:help-circle-outline', color: '#A0C4FF' },
  EXAMPLE: { defaultTitle: 'Пример', icon: 'mdi:bookmark-outline', color: '#BDB2FF' },
  QUOTE: { defaultTitle: 'Цитата', icon: 'mdi:format-quote-close', color: '#FFC6FF' },
}

function localDateTimeToMinutes(value?: string): number | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match)
    return null

  return Math.floor(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  ) / 60_000)
}

function activityDateTimeToMinutes(dayDate: string | undefined, time: string): number | null {
  if (!dayDate || !/^\d{2}:\d{2}$/.test(time))
    return null

  return localDateTimeToMinutes(`${dayDate}T${time}`)
}

function flightSegmentOverlapsActivity(
  act: ActivityPayload,
  dayDate: string | undefined,
  departureDateTime?: string,
  arrivalDateTime?: string,
): boolean | null {
  const activityStart = activityDateTimeToMinutes(dayDate, act.startTime)
  let activityEnd = activityDateTimeToMinutes(dayDate, act.endTime)
  const flightStart = localDateTimeToMinutes(departureDateTime)
  let flightEnd = localDateTimeToMinutes(arrivalDateTime)

  if (activityStart === null || activityEnd === null || flightStart === null)
    return null

  if (activityEnd <= activityStart)
    activityEnd += 24 * 60
  if (flightEnd === null || flightEnd <= flightStart)
    flightEnd = flightStart + 1

  return activityStart < flightEnd && activityEnd > flightStart
}

export function getCalloutMetadata(type: string, rawTitle?: string): { title: string, icon: string, color: string } {
  const upperType = type.toUpperCase()
  const meta = CALLOUT_META_MAP[upperType] || { defaultTitle: 'Заметка', icon: 'mdi:information-outline', color: '#A3D9A5' }
  const cleanTitle = rawTitle?.trim() || meta.defaultTitle
  return {
    title: cleanTitle,
    icon: meta.icon,
    color: meta.color,
  }
}

export async function enrichActivityWithMediaAndLocation(
  act: ActivityPayload,
  imageIndex: Map<string, string>,
  api: ImageUploader | null,
  tripId: string | null,
  geoCache: Map<string, [number, number]>,
  uploadCache: Map<string, string>,
  options: {
    uploadImages?: boolean
    geocode?: boolean
    locationContext?: string
    metroCityContext?: string
    resolveMetro?: MetroActivityResolver
    bookings?: Booking[]
    dayDate?: string
    gpxIndex?: Map<string, string>
    onProgress?: (message: string) => void
    persistentImageCache?: Map<string, ImageCacheEntry>
  } = {},
): Promise<ActivityPayload> {
  if (options.resolveMetro)
    act = await options.resolveMetro(act, options.metroCityContext ?? options.locationContext)

  const shouldUpload = options.uploadImages !== false && api !== null && tripId !== null
  const shouldGeocode = options.geocode !== false
  const notify = options.onProgress || (() => { })

  const newSections: ActivitySection[] = []

  const inputSections = act.sections && act.sections.length > 0
    ? act.sections
    : []

  let accumulatedDescription = ''
  const customOtherSections: ActivitySection[] = []

  for (const sec of inputSections) {
    if (sec.type === 'description' && sec.text) {
      accumulatedDescription += `${sec.text}\n\n`
    }
    else {
      customOtherSections.push(sec)
    }
  }

  if (!accumulatedDescription.trim()) {
    return act
  }

  let text = accumulatedDescription

  // 0. GPX-треки: явные ссылки на .gpx-файлы вольта ([[трек.gpx]], ![[трек.gpx|Название]], [Название](трек.gpx)).
  // Убираем их из текста до парсинга локаций, чтобы не уехать в геокодер с «chinan.gpx».
  const gpxReferences = extractGpxReferences(text)
  for (const ref of gpxReferences) {
    if (text.includes(ref.rawText))
      text = text.split(ref.rawText).join('')
  }

  // 1. Extract location iframes & map links (support Yandex, Google, 2GIS, OSM, direct coords)
  const extractedLocations = extractLocationsFromText(text)

  // 2. Extract structured galleries, image callouts & wikilinks
  const parsedGalleries = extractGalleryBlocks(text)
  text = parsedGalleries.text
  const foundImageNames: string[] = [...new Set(parsedGalleries.galleries.flatMap(gallery => gallery.images))]
  const explicitImageNames = new Set(foundImageNames)
  const imageCalloutRegex = />\s*\[!INFO\]-?\s*(?:Картинки|Изображения|Фото|Photos|Images)[\s\S]*?(?=\n[\t\v\f\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s*[^\s>]|\n\s*##|\n\s*###|\n\s*---|\n\s*\*\s*\*\*|$)/gi
  const callouts = text.match(imageCalloutRegex) || []

  for (const callout of callouts) {
    const wikilinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let m: RegExpExecArray | null
    while ((m = wikilinkRegex.exec(callout)) !== null) {
      const fileName = m[1].trim().replace(/^\.\//, '')
      if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(fileName) && !foundImageNames.includes(fileName)) {
        foundImageNames.push(fileName)
      }
    }
  }

  // Also check non-callout wikilinks in text
  const nonCalloutWikilinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let mWikilink: RegExpExecArray | null
  while ((mWikilink = nonCalloutWikilinkRegex.exec(text)) !== null) {
    const fileName = mWikilink[1].trim().replace(/^\.\//, '')
    if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(fileName) && !foundImageNames.includes(fileName)) {
      foundImageNames.push(fileName)
    }
  }

  // Also check standard markdown images ![alt](path)
  const mdImageRegex = /!\[[^\]]*\]\(([^)]+\.(?:png|jpg|jpeg|webp|gif|heic|heif|svg))\)/gi
  let mMdImage: RegExpExecArray | null
  while ((mMdImage = mdImageRegex.exec(text)) !== null) {
    const fileName = mMdImage[1].trim().replace(/^\.\//, '')
    if (!/^https?:\/\//i.test(fileName) && !foundImageNames.includes(fileName)) {
      foundImageNames.push(fileName)
    }
  }

  // 3. Extract note/tip callouts inside activity as separate attached Note sections (isAttached: true)
  const noteSections: ActivitySectionDescription[] = []
  const noteCalloutRegex = />\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION|INFO|QUOTE|FAQ|QUESTION|EXAMPLE)\]-?\s*([^\n]*)\n((?:[ \t]*>[^\n]*\n?)*)/gi
  for (const match of text.matchAll(noteCalloutRegex)) {
    const type = match[1].toUpperCase()
    const rawTitle = match[2].trim()
    if (/^(?:Картинки|Изображения|Фото|Photos|Images)$/i.test(rawTitle))
      continue

    const rawBody = match[3] || ''
    const cleanBodyLines = rawBody
      .split('\n')
      .map(l => l.replace(/^[ \t]*>[ \t]?/, ''))
      .join('\n')
      .trim()

    const meta = getCalloutMetadata(type, rawTitle)
    const calloutBody = dedentText(cleanBodyLines) || meta.title

    noteSections.push({
      id: stableId('activity-note', act.startTime, meta.title, calloutBody),
      type: 'description',
      isAttached: true,
      title: meta.title,
      icon: meta.icon,
      color: meta.color,
      text: calloutBody,
    })
  }

  // 3b. Extract external trail links (AllTrails, Hikingbook, Komoot, Wikiloc, Strava) and preserve as attached cards
  const externalTrailLinks = extractExternalTrailLinks(text)
  for (const trail of externalTrailLinks) {
    const cleanTitle = trail.title
      .replace(/^(?:AllTrails|Hikingbook|Komoot|Wikiloc|Strava|Трек|Маршрут|Велотрек|Веломаршрут):\s*/i, '')
      .trim()
    const platform = trail.url.includes('alltrails.com')
      ? 'AllTrails'
      : trail.url.includes('hikingbook.net')
        ? 'Hikingbook'
        : trail.url.includes('komoot.com')
          ? 'Komoot'
          : trail.url.includes('wikiloc.com')
            ? 'Wikiloc'
            : 'карте'
    noteSections.push({
      id: stableId('activity-trail', act.startTime, trail.url),
      type: 'description',
      isAttached: true,
      title: trail.isBike ? 'Веломаршрут' : 'Хайкинг-трек',
      icon: trail.isBike ? 'mdi:bicycle' : 'mdi:hiking',
      color: '#A0C4FF',
      text: `🗺️ **${cleanTitle || trail.title}**\n\n[Открыть трек в ${platform}](${trail.url})`,
    })
  }

  // 4. Process Locations -> Geolocation Section ("Локация")
  let geoSection: ActivitySectionGeolocation | null = null
  if (extractedLocations.length > 0 || gpxReferences.length > 0) {
    const mapPoints: GeolocationPoint[] = []
    // Group trail waypoints into routes
    const routeGroups = new Map<string, Array<GeolocationPoint & { isBike?: boolean }>>()

    for (const loc of extractedLocations) {
      let coordinates: [number, number] | null = loc.coordinates || null

      if (!coordinates && shouldGeocode && loc.pointType !== 'connect') {
        notify(`📍 Геокодирование: ${loc.name || loc.query}`)
        coordinates = await geocodeLocation(loc.query, geoCache, options.locationContext)
        if (!coordinates && loc.name && loc.name !== loc.query) {
          coordinates = await geocodeLocation(loc.name, geoCache, options.locationContext)
        }
      }

      if (!coordinates)
        continue

      if (loc.routeName) {
        const routeName = loc.routeName
        if (!routeGroups.has(routeName)) {
          routeGroups.set(routeName, [])
        }
        const pts = routeGroups.get(routeName)!
        pts.push({
          id: stableId('activity-map-point', act.startTime, routeName, coordinates.join(',')),
          coordinates,
          type: loc.pointType || 'via',
          address: loc.pointType === 'connect' ? undefined : (loc.name || undefined),
          comment: undefined,
          externalUrl: loc.externalUrl,
          isBike: loc.isBike,
        })
      }
      else {
        // Detect waypoint pattern: "Route Name (Точка N)"
        const waypointMatch = loc.name.match(/^(.+)\s+\(Точка\s+(\d+)\)$/)
        if (waypointMatch) {
          const routeName = waypointMatch[1].trim()
          const ptIndex = Number.parseInt(waypointMatch[2], 10)
          if (!routeGroups.has(routeName)) {
            routeGroups.set(routeName, [])
          }
          const pts = routeGroups.get(routeName)!
          const pointType: GeolocationPoint['type'] = ptIndex === 1 ? 'start' : 'via'
          pts.push({
            id: stableId('activity-map-point', act.startTime, routeName, ptIndex, coordinates.join(',')),
            coordinates,
            type: pointType,
            address: routeName,
            comment: undefined,
            externalUrl: loc.externalUrl,
            isBike: loc.isBike,
          })
        }
        else {
          mapPoints.push({
            id: stableId('activity-map-point', act.startTime, loc.name, coordinates.join(',')),
            coordinates,
            type: 'poi',
            address: loc.name,
            comment: undefined,
            externalUrl: loc.externalUrl,
          })
        }
      }
    }

    // Build route objects for trail groups
    const routes: any[] = []
    for (const [routeName, pts] of routeGroups) {
      if (pts.length > 1) {
        const orderedPts = pts.map((p, i) => {
          let type: GeolocationPoint['type'] = p.type
          if (i === 0)
            type = 'start'
          else if (i === pts.length - 1)
            type = 'end'
          else if (type !== 'connect')
            type = 'via'

          return {
            id: p.id,
            coordinates: p.coordinates,
            type,
            address: type === 'connect' ? undefined : p.address,
            comment: undefined,
            externalUrl: p.externalUrl,
          }
        })
        const isBike = /вело|bike/i.test(routeName) || pts.some(p => p.isBike)
        routes.push({
          id: stableId('activity-route', act.startTime, routeName),
          title: routeName,
          points: orderedPts,
          transportMode: extractLabeledRouteMode(accumulatedDescription, pts.find(p => p.externalUrl)?.externalUrl || '') || extractRouteTransportMode(pts.find(p => p.externalUrl)?.externalUrl || undefined) || (isBike ? 'bike' : 'foot'),
          isVisible: true,
          isFetching: false,
        })
      }
      else {
        // Only one point resolved — add as POI
        pts.forEach(p => mapPoints.push({
          id: p.id,
          coordinates: p.coordinates,
          type: 'poi',
          address: p.address,
          comment: undefined,
          externalUrl: p.externalUrl,
        }))
      }
    }

    // Build route objects for attached GPX tracks (full geometry, no geocoding)
    for (const ref of gpxReferences) {
      const filePath = options.gpxIndex ? resolveGpxFile(ref.fileName, options.gpxIndex) : null
      if (!filePath) {
        notify(`⚠ GPX-файл не найден в вольте: ${ref.fileName}`)
        continue
      }
      const track = parseGpxFile(filePath)
      if (!track || track.coordinates.length < 2) {
        notify(`⚠ GPX-трек не содержит точек: ${ref.fileName}`)
        continue
      }
      const title = ref.label || track.name || ref.fileName.replace(/\.gpx$/i, '')
      for (const landmark of track.landmarks) {
        mapPoints.push({
          id: stableId('activity-map-point', act.startTime, ref.fileName, 'landmark', landmark.name, landmark.coordinates.join(',')),
          coordinates: landmark.coordinates,
          type: 'poi',
          address: landmark.name,
        })
      }
      routes.push({
        id: stableId('activity-route', act.startTime, 'gpx', ref.fileName),
        title,
        points: track.checkpoints.map((point, index) => ({
          id: point.type === 'via' || point.type === 'connect'
            ? stableId('activity-map-point', act.startTime, ref.fileName, point.type, index, point.name, point.coordinates.join(','))
            : stableId('activity-map-point', act.startTime, ref.fileName, point.type),
          coordinates: point.coordinates,
          type: point.type,
          address: point.name,
        })),
        transportMode: ref.isBike ? 'bike' : 'foot',
        distance: Math.round(track.distance),
        ...(track.duration !== undefined ? { duration: track.duration } : {}),
        geometry: track.coordinates,
        isVisible: true,
        isFetching: false,
      })
    }

    if (mapPoints.length > 0 || routes.length > 0) {
      const routeLabels = routes.map(r => r.title)
      // Filter out POI labels that are already part of route titles to prevent "Jiufen Old Street • Jiufen Old Street Entrance → ..."
      const poiLabels = mapPoints
        .map(p => p.address)
        .filter((addr): addr is string => addr != null && addr.trim() !== '' && !routeLabels.some(r => r.toLowerCase().includes(addr.toLowerCase())))

      const sectionTitle = [...poiLabels, ...routeLabels].join(' • ') || routes[0]?.title || mapPoints[0]?.address || 'Локация'
      const geoMeta = computeGeoBoundsAndCenter(mapPoints, routes)
      const center = geoMeta?.center || mapPoints[0]?.coordinates || routes[0]?.points[0]?.coordinates
      const totalPoints = mapPoints.length + routes.reduce((s: number, r: any) => s + r.points.length, 0)
      const zoom = geoMeta?.zoom ?? (totalPoints > 2 ? 11 : totalPoints > 1 ? 12 : 13.5)
      geoSection = {
        id: stableId('activity-geolocation', act.startTime),
        type: 'geolocation',
        title: sectionTitle,
        points: mapPoints,
        routes,
        center,
        zoom,
      }
    }
  }

  // 5. Clean description: remove location lines, iframes, image callouts, wikilinks, and note callouts
  text = text
    .replace(/^[ \t]*(?:[*-][ \t]*)?(?:_[^_\n]*(?:локаци|карт|маршрут|путь|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^_\n]*_|\*\*[^*\n]*(?:локаци|карт|маршрут|путь|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^*\n]*\*\*):[^\n]*\n?/gmi, '')
    .replace(/<iframe[^>]*src=["'](?:https?:)?\/\/[^"']*["'][^>]*>\s*<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\[(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|AllTrails|Hikingbook|Карты Yandex|Карты Google|Карты|Maps|Трек|Маршрут|Велотрек|Веломаршрут)[^\]]+\]\([^)]+\)/gi, '')
    .replace(imageCalloutRegex, '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(noteCalloutRegex, '')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')

  text = dedentText(text)

  // Add primary cleaned description section if text remains
  if (text) {
    newSections.push({
      id: stableId('activity-description', act.startTime, text),
      type: 'description',
      text,
    })
  }

  // Add note/tip sections (Заметка)
  for (const noteSec of noteSections) {
    newSections.push(noteSec)
  }

  // Add geolocation section
  if (geoSection) {
    newSections.push(geoSection)
  }

  // 6. Process Images -> Gallery Section ("Галерея")
  const galleryGroups = [
    ...parsedGalleries.galleries.map(gallery => ({ title: gallery.title, images: gallery.images })),
    ...(foundImageNames.some(image => !explicitImageNames.has(image))
      ? [{ title: '', images: foundImageNames.filter(image => !explicitImageNames.has(image)) }]
      : []),
  ]
  if (galleryGroups.length === 0 && foundImageNames.length > 0)
    galleryGroups.push({ title: '', images: foundImageNames })

  if (galleryGroups.length > 0) {
    for (const gallery of galleryGroups) {
      const resolvedUrls = await pMap(gallery.images, async (imgName) => {
        const localPath = resolveImageFromIndex(imgName, imageIndex)
        if (localPath) {
          if (shouldUpload && api && tripId) {
            try {
              if (uploadCache.has(localPath)) {
                return uploadCache.get(localPath)!
              }
              notify(`📸 Загрузка фото: ${imgName}`)
              const uploadedUrl = await uploadSingleImage(
                tripId,
                localPath,
                api,
                uploadCache,
                options.persistentImageCache,
                'route',
              )
              return uploadedUrl || null
            }
            catch (uploadErr: any) {
              console.warn(`      ${colors.yellow}⚠ Ошибка загрузки фото ${imgName}: ${uploadErr.message}${colors.reset}`)
              throw uploadErr
            }
          }
        }
        return null
      }, 4)

      const uploadedImageUrls = resolvedUrls.filter((url): url is string => Boolean(url))

      if (uploadedImageUrls.length > 0) {
        newSections.push({
          id: stableId('activity-gallery', act.startTime, gallery.title, uploadedImageUrls.join('|')),
          type: 'gallery',
          imageUrls: uploadedImageUrls,
          ...(gallery.title ? { title: gallery.title } : {}),
        })
      }
    }
  }

  // 7. Process Bookings Matching -> Booking Section ("Бронирование")
  if (options.bookings && options.bookings.length > 0) {
    const actText = `${act.title} ${accumulatedDescription}`.toLowerCase()
    const hasBookingSection = newSections.some(s => s.type === 'booking') || customOtherSections.some(s => s.type === 'booking')
    const currentDayDate = options.dayDate // YYYY-MM-DD
    const hotelActivityKind = getHotelActivityKind(act.title)
    const hotelBookingsForDay = options.bookings.filter((candidate) => {
      if (candidate.type !== 'hotel')
        return false
      const { checkInDate, checkOutDate } = candidate.data
      return !currentDayDate || !checkInDate || (currentDayDate >= checkInDate && (!checkOutDate || currentDayDate <= checkOutDate))
    })

    if (!hasBookingSection) {
      for (const booking of options.bookings) {
        // Старые импорты могли содержать пешие переходы среди бронирований.
        if (booking.type === 'other' && (booking.data.kind === 'pedestrian' || booking.icon === 'mdi:walk'))
          continue
        let isMatched = false
        if (booking.type === 'hotel') {
          if (hotelActivityKind && hotelBookingsForDay.some(candidate => candidate.id === booking.id)) {
            const namedMatches = hotelBookingsForDay.filter(candidate => candidate.type === 'hotel'
              && matchesHotelBookingActivity(act.title, candidate.data.hotelName || ''))

            if (namedMatches.length === 1) {
              isMatched = namedMatches[0].id === booking.id
            }
            else if (namedMatches.length === 0) {
              if (hotelActivityKind === 'check-in') {
                const sameDayCheckIns = currentDayDate
                  ? hotelBookingsForDay.filter(candidate => candidate.type === 'hotel' && candidate.data.checkInDate === currentDayDate)
                  : []
                isMatched = sameDayCheckIns.length === 1
                  ? sameDayCheckIns[0].id === booking.id
                  : hotelBookingsForDay.length === 1 && hotelBookingsForDay[0].id === booking.id
              }
              else {
                isMatched = hotelBookingsForDay.length === 1 && hotelBookingsForDay[0].id === booking.id
              }
            }
          }
        }
        else if (booking.type === 'flight') {
          for (const seg of booking.data.segments || []) {
            const segDate = seg.departureDateTime?.split('T')[0]
            const isDateMatch = !currentDayDate || !segDate || currentDayDate === segDate
            const overlapsActivity = flightSegmentOverlapsActivity(
              act,
              currentDayDate,
              seg.departureDateTime,
              seg.arrivalDateTime,
            )

            if (seg.flightNumber
              && actText.includes(seg.flightNumber.toLowerCase())
              && isDateMatch
              && overlapsActivity !== false) {
              isMatched = true
              break
            }
          }
          if (!isMatched && /авиаперелет|перелет|вылет|аэропорт/i.test(act.title)) {
            const depCity = booking.data.segments?.[0]?.departureCity?.toLowerCase()
            const arrCity = booking.data.segments?.[booking.data.segments.length - 1]?.arrivalCity?.toLowerCase()
            const firstSegment = booking.data.segments?.[0]
            const lastSegment = booking.data.segments?.[booking.data.segments.length - 1]
            const segDate = firstSegment?.departureDateTime?.split('T')[0]
            const isDateMatch = !currentDayDate || !segDate || currentDayDate === segDate
            const overlapsActivity = flightSegmentOverlapsActivity(
              act,
              currentDayDate,
              firstSegment?.departureDateTime,
              lastSegment?.arrivalDateTime,
            )

            if (depCity
              && arrCity
              && actText.includes(depCity)
              && actText.includes(arrCity)
              && isDateMatch
              && overlapsActivity !== false) {
              isMatched = true
            }
          }
        }
        else if (booking.type === 'train') {
          const trainNum = booking.data.trainNumber?.toLowerCase()
          const trainDate = booking.data.departureDateTime?.split('T')[0]
          const isDateMatch = !currentDayDate || !trainDate || currentDayDate === trainDate

          // Only visible prose can identify a train; URL coordinates often contain its number.
          const trainText = `${act.title} ${accumulatedDescription}`
            .replace(/<[^>]*>/g, ' ')
            .replace(/https?:\/\/[^\s)<>]+/g, ' ')
            .toLowerCase()
          const escapedNumber = trainNum?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const numberMatch = !!escapedNumber && new RegExp(`(?<![\\p{L}\\p{N}])${escapedNumber}(?![\\p{L}\\p{N}])`, 'u').test(trainText)
          const overlaps = flightSegmentOverlapsActivity(act, currentDayDate, booking.data.departureDateTime, booking.data.arrivalDateTime)
          const departureCity = booking.data.departureStation?.toLowerCase()
          const arrivalCity = booking.data.arrivalStation?.toLowerCase()
          const routeMatch = /(?:поезд|train|thsr|tra\b)/iu.test(act.title)
            && !!departureCity && !!arrivalCity
            && trainText.includes(departureCity) && trainText.includes(arrivalCity)
            && overlaps === true

          if (isDateMatch && overlaps !== false && (numberMatch || routeMatch)) {
            isMatched = true
          }
        }
        else if (booking.type === 'car') {
          const company = booking.data.company?.toLowerCase()
          const model = booking.data.carModel?.toLowerCase()
          if ((company && company.length >= 4 && actText.includes(company))
            || (model && model.length >= 4 && actText.includes(model))
            || (booking.title && booking.title.length >= 5 && actText.includes(booking.title.toLowerCase()))) {
            isMatched = true
          }
        }
        else if (booking.type === 'other') {
          const name = booking.data.name?.toLowerCase()
          if ((name && name.length >= 4 && actText.includes(name))
            || (booking.title && booking.title.length >= 5 && actText.includes(booking.title.toLowerCase()))) {
            isMatched = true
          }
        }

        if (isMatched) {
          newSections.push({
            id: stableId('activity-booking', act.startTime, booking.id),
            type: 'booking',
            bookingId: booking.id,
          })
          break
        }
      }
    }
  }

  // Add custom other sections preserved
  for (const sec of customOtherSections) {
    newSections.push(sec)
  }

  return {
    ...act,
    sections: newSections.map((section, index) => ({
      ...section,
      id: stableId('activity-section', act.startTime, section.type, index),
    })),
  }
}
