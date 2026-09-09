import type {
  ActivityPayload,
  ActivitySection,
  ActivitySectionDescription,
  Booking,
  GeolocationPoint,
} from '../types'
import type { ApiClient } from './api-client'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { colors } from '../config/colors'
import { dedentText } from '../parsers/activity'
import { extractExternalTrailLinks, extractLocationsFromText } from '../parsers/location'
import { geocodeLocation } from './geocode'

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
  api: ApiClient | null,
  tripId: string | null,
  geoCache: Map<string, [number, number]>,
  uploadCache: Map<string, string>,
  options: {
    uploadImages?: boolean
    geocode?: boolean
    locationContext?: string
    bookings?: Booking[]
    dayDate?: string
    onProgress?: (message: string) => void
  } = {},
): Promise<ActivityPayload> {
  const shouldUpload = options.uploadImages !== false && api !== null && tripId !== null
  const shouldGeocode = options.geocode !== false
  const notify = options.onProgress || (() => {})

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

  // 1. Extract location iframes & map links (support Yandex, Google, 2GIS, OSM, direct coords)
  const extractedLocations = extractLocationsFromText(text)

  // 2. Extract image callouts & wikilinks
  const foundImageNames: string[] = []
  const imageCalloutRegex = />\s*\[!INFO\]-?\s*(?:Картинки|Изображения|Фото|Photos|Images)[\s\S]*?(?=\n[\t\v\f\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s*[^\s>]|\n\s*##|\n\s*###|\n\s*---|\n\s*\*\s*\*\*|$)/gi
  const callouts = text.match(imageCalloutRegex) || []

  for (const callout of callouts) {
    const wikilinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let m: RegExpExecArray | null
    while ((m = wikilinkRegex.exec(callout)) !== null) {
      const fileName = basename(m[1].trim())
      if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(fileName) && !foundImageNames.includes(fileName)) {
        foundImageNames.push(fileName)
      }
    }
  }

  // Also check non-callout wikilinks in text
  const nonCalloutWikilinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let mWikilink: RegExpExecArray | null
  while ((mWikilink = nonCalloutWikilinkRegex.exec(text)) !== null) {
    const fileName = basename(mWikilink[1].trim())
    if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(fileName) && !foundImageNames.includes(fileName)) {
      foundImageNames.push(fileName)
    }
  }

  // Also check standard markdown images ![alt](path)
  const mdImageRegex = /!\[[^\]]*\]\(([^)]+\.(?:png|jpg|jpeg|webp|gif|heic|heif|svg))\)/gi
  let mMdImage: RegExpExecArray | null
  while ((mMdImage = mdImageRegex.exec(text)) !== null) {
    const fileName = basename(mMdImage[1].trim())
    if (!foundImageNames.includes(fileName)) {
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      type: 'description',
      isAttached: true,
      title: trail.isBike ? 'Веломаршрут' : 'Хайкинг-трек',
      icon: trail.isBike ? 'mdi:bicycle' : 'mdi:hiking',
      color: '#A0C4FF',
      text: `🗺️ **${cleanTitle || trail.title}**\n\n[Открыть трек в ${platform}](${trail.url})`,
    })
  }

  // 4. Clean description: remove location lines, iframes, image callouts, wikilinks, and note callouts
  text = text
    .replace(/^[ \t]*(?:[*-][ \t]*)?(?:_[^_\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^_\n]*_|\*\*[^*\n]*(?:локаци|карт|маршрут|maps?|ориентир|ссылка|хайкинг|трек|trail|точк|старт|финиш|вело|велотрек)[^*\n]*\*\*):[^\n]*\n?/gmi, '')
    .replace(/<iframe[^>]*src=["'](?:https?:)?\/\/[^"']*["'][^>]*>\s*<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\[(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|AllTrails|Hikingbook|Карты Yandex|Карты Google|Карты|Maps|Трек|Маршрут|Велотрек|Веломаршрут)[^\]]+\]\([^)]+\)/gi, '')
    .replace(imageCalloutRegex, '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(noteCalloutRegex, '')
    .replace(/\n{3,}/g, '\n\n')

  text = dedentText(text)

  // Add primary cleaned description section if text remains
  if (text) {
    newSections.push({
      id: crypto.randomUUID(),
      type: 'description',
      text,
    })
  }

  // Add note/tip sections (Заметка)
  for (const noteSec of noteSections) {
    newSections.push(noteSec)
  }

  // 5. Process Locations -> Geolocation Section ("Локация")
  if (extractedLocations.length > 0) {
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
          id: crypto.randomUUID(),
          coordinates,
          type: loc.pointType || 'via',
          address: loc.pointType === 'connect' ? undefined : (loc.name || undefined),
          comment: undefined,
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
            id: crypto.randomUUID(),
            coordinates,
            type: pointType,
            address: routeName,
            comment: undefined,
            isBike: loc.isBike,
          })
        }
        else {
          mapPoints.push({
            id: crypto.randomUUID(),
            coordinates,
            type: 'poi',
            address: loc.name,
            comment: undefined,
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
          }
        })
        const isBike = /вело|bike/i.test(routeName) || pts.some(p => p.isBike)
        routes.push({
          id: crypto.randomUUID(),
          title: routeName,
          points: orderedPts,
          transportMode: isBike ? 'bike' : 'foot',
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
        }))
      }
    }

    if (mapPoints.length > 0 || routes.length > 0) {
      const routeLabels = routes.map(r => r.title)
      // Filter out POI labels that are already part of route titles to prevent "Jiufen Old Street • Jiufen Old Street Entrance → ..."
      const poiLabels = mapPoints
        .map(p => p.address)
        .filter((addr): addr is string => addr != null && addr.trim() !== '' && !routeLabels.some(r => r.toLowerCase().includes(addr.toLowerCase())))

      const sectionTitle = [...poiLabels, ...routeLabels].join(' • ') || routes[0]?.title || mapPoints[0]?.address || 'Локация'
      const center = mapPoints[0]?.coordinates || routes[0]?.points[0]?.coordinates
      const totalPoints = mapPoints.length + routes.reduce((s: number, r: any) => s + r.points.length, 0)
      newSections.push({
        id: crypto.randomUUID(),
        type: 'geolocation',
        title: sectionTitle,
        points: mapPoints,
        routes,
        center,
        zoom: totalPoints > 2 ? 12 : totalPoints > 1 ? 13 : 14,
      })
    }
  }

  // 6. Process Images -> Gallery Section ("Галерея")
  if (foundImageNames.length > 0) {
    const uploadedImageUrls: string[] = []

    for (let imgIdx = 0; imgIdx < foundImageNames.length; imgIdx++) {
      const imgName = foundImageNames[imgIdx]
      const localPath = imageIndex.get(imgName) || imageIndex.get(imgName.toLowerCase())
      if (localPath && existsSync(localPath)) {
        if (shouldUpload && api && tripId) {
          try {
            if (uploadCache.has(localPath)) {
              uploadedImageUrls.push(uploadCache.get(localPath)!)
            }
            else {
              notify(`📸 Загрузка фото [${imgIdx + 1}/${foundImageNames.length}]: ${imgName}`)
              const uploadedUrl = await api.uploadImage(tripId, localPath, 'route')
              if (uploadedUrl) {
                uploadCache.set(localPath, uploadedUrl)
                uploadedImageUrls.push(uploadedUrl)
              }
            }
          }
          catch (uploadErr: any) {
            console.warn(`      ${colors.yellow}⚠ Ошибка загрузки фото ${imgName}: ${uploadErr.message}${colors.reset}`)
          }
        }
        else {
          uploadedImageUrls.push(imgName)
        }
      }
    }

    if (uploadedImageUrls.length > 0) {
      newSections.push({
        id: crypto.randomUUID(),
        type: 'gallery',
        imageUrls: uploadedImageUrls,
      })
    }
  }

  // 7. Process Bookings Matching -> Booking Section ("Бронирование")
  if (options.bookings && options.bookings.length > 0) {
    const actText = `${act.title} ${accumulatedDescription}`.toLowerCase()
    const hasBookingSection = newSections.some(s => s.type === 'booking') || customOtherSections.some(s => s.type === 'booking')
    const currentDayDate = options.dayDate // YYYY-MM-DD

    if (!hasBookingSection) {
      for (const booking of options.bookings) {
        let isMatched = false
        if (booking.type === 'hotel') {
          // Check date window if dayDate is available
          const inDate = booking.data.checkInDate
          const outDate = booking.data.checkOutDate
          const isInDateWindow = !currentDayDate || !inDate || (currentDayDate >= inDate && (!outDate || currentDayDate <= outDate))

          if (isInDateWindow) {
            const hotelName = booking.data.hotelName?.toLowerCase() || ''
            const shortName = hotelName.replace(/hotel|hostel|villa|inn|b&b|boutique|resort|гостиница|отель/gi, '').trim()
            if (shortName.length >= 4 && actText.includes(shortName)) {
              isMatched = true
            }
            else if (hotelName && hotelName.length >= 4 && actText.includes(hotelName)) {
              isMatched = true
            }
            else if (booking.title && booking.title.length >= 4 && actText.includes(booking.title.toLowerCase()) && /отел|заселен|check-in|checkout|гостиниц/i.test(actText)) {
              isMatched = true
            }
          }
        }
        else if (booking.type === 'flight') {
          for (const seg of booking.data.segments || []) {
            const segDate = seg.departureDateTime?.split('T')[0]
            const isDateMatch = !currentDayDate || !segDate || currentDayDate === segDate

            if (seg.flightNumber && actText.includes(seg.flightNumber.toLowerCase()) && isDateMatch) {
              isMatched = true
              break
            }
          }
          if (!isMatched && /авиаперелет|перелет|вылет|аэропорт/i.test(act.title)) {
            const depCity = booking.data.segments?.[0]?.departureCity?.toLowerCase()
            const arrCity = booking.data.segments?.[booking.data.segments.length - 1]?.arrivalCity?.toLowerCase()
            const segDate = booking.data.segments?.[0]?.departureDateTime?.split('T')[0]
            const isDateMatch = !currentDayDate || !segDate || currentDayDate === segDate

            if (depCity && arrCity && actText.includes(depCity) && actText.includes(arrCity) && isDateMatch) {
              isMatched = true
            }
          }
        }
        else if (booking.type === 'train') {
          const trainNum = booking.data.trainNumber?.toLowerCase()
          const trainDate = booking.data.departureDateTime?.split('T')[0]
          const isDateMatch = !currentDayDate || !trainDate || currentDayDate === trainDate

          if (trainNum && actText.includes(trainNum) && isDateMatch) {
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

        if (isMatched) {
          newSections.push({
            id: crypto.randomUUID(),
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
    sections: newSections,
  }
}
