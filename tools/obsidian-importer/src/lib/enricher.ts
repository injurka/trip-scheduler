import type {
  ActivityPayload,
  ActivitySection,
  ActivitySectionDescription,
  GeolocationPoint,
} from '../types'
import type { ApiClient } from './api-client'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { colors } from '../config/colors'
import { extractLocationsFromText } from '../parsers/location'
import { geocodeLocation } from './geocode'

export async function enrichActivityWithMediaAndLocation(
  act: ActivityPayload,
  imageIndex: Map<string, string>,
  api: ApiClient | null,
  tripId: string | null,
  geoCache: Map<string, [number, number]>,
  uploadCache: Map<string, string>,
  options: { uploadImages?: boolean, geocode?: boolean, locationContext?: string } = {},
): Promise<ActivityPayload> {
  const shouldUpload = options.uploadImages !== false && api !== null && tripId !== null
  const shouldGeocode = options.geocode !== false

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
    const wikilinkRegex = /!\[\[([^\]]+)\]\]/g
    let m: RegExpExecArray | null
    while ((m = wikilinkRegex.exec(callout)) !== null) {
      const fileName = basename(m[1].trim())
      if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(fileName) && !foundImageNames.includes(fileName)) {
        foundImageNames.push(fileName)
      }
    }
  }

  // Also check non-callout wikilinks in text
  const nonCalloutWikilinkRegex = /!\[\[([^\]]+)\]\]/g
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

  // 3. Extract note/tip callouts inside activity as separate Note sections
  const noteSections: ActivitySectionDescription[] = []
  const noteCalloutRegex = />\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION|INFO|QUOTE|FAQ|QUESTION|EXAMPLE)\]-?\s*([^\n]*)\n((?:[ \t]*>[^\n]*\n?)*)/gi
  for (const match of text.matchAll(noteCalloutRegex)) {
    const type = match[1].toUpperCase()
    const title = match[2].trim()
    if (/^(?:Картинки|Изображения|Фото|Photos|Images)$/i.test(title))
      continue

    const rawBody = match[3] || ''
    const cleanBodyLines = rawBody
      .split('\n')
      .map(l => l.replace(/^[ \t]*>[ \t]?/, ''))
      .join('\n')
      .trim()

    const fullCalloutText = `> [!${type}] ${title}\n${cleanBodyLines ? cleanBodyLines.split('\n').map(l => `> ${l}`).join('\n') : ''}`.trim()

    noteSections.push({
      id: crypto.randomUUID(),
      type: 'description',
      text: fullCalloutText,
    })
  }

  // 4. Clean description: remove location lines, iframes, image callouts, wikilinks, and note callouts
  text = text
    .replace(/^[ \t]*(?:[*-][ \t]*)?_[Сс]сылка на локацию_:[^\n]*\n?/gm, '')
    .replace(/<iframe[^>]*src=["'](?:https?:)?\/\/[^"']*["'][^>]*>\s*<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\[(?:Yandex Maps|Google Maps|2GIS|OpenStreetMap|Карты Yandex|Карты Google|Карты|Maps):[^\]]+\]\([^)]+\)/gi, '')
    .replace(imageCalloutRegex, '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(noteCalloutRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

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

    for (const loc of extractedLocations) {
      let coordinates: [number, number] | null = loc.coordinates || null

      if (!coordinates && shouldGeocode) {
        coordinates = await geocodeLocation(loc.query, geoCache, options.locationContext)
        if (!coordinates && loc.name && loc.name !== loc.query) {
          coordinates = await geocodeLocation(loc.name, geoCache, options.locationContext)
        }
      }

      if (coordinates) {
        mapPoints.push({
          id: crypto.randomUUID(),
          coordinates,
          type: 'poi',
          address: loc.name,
          comment: loc.name,
        })
      }
    }

    if (mapPoints.length > 0) {
      const sectionTitle = mapPoints.map(p => p.address).filter(Boolean).join(' • ')
      newSections.push({
        id: crypto.randomUUID(),
        type: 'geolocation',
        title: sectionTitle,
        points: mapPoints,
        routes: [],
        drawnRoutes: [],
        center: mapPoints[0].coordinates,
        zoom: mapPoints.length > 1 ? 13 : 14,
      })
    }
  }

  // 6. Process Images -> Gallery Section ("Галерея")
  if (foundImageNames.length > 0) {
    const uploadedImageUrls: string[] = []

    for (const imgName of foundImageNames) {
      const localPath = imageIndex.get(imgName) || imageIndex.get(imgName.toLowerCase())
      if (localPath && existsSync(localPath)) {
        if (shouldUpload && api && tripId) {
          try {
            if (uploadCache.has(localPath)) {
              uploadedImageUrls.push(uploadCache.get(localPath)!)
            }
            else {
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

  // Add custom other sections preserved
  for (const sec of customOtherSections) {
    newSections.push(sec)
  }

  return {
    ...act,
    sections: newSections,
  }
}
