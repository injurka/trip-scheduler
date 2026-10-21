import { readFileSync } from 'node:fs'

export interface GpxReference {
  /** Имя файла из ссылки (может содержать путь внутри вольта) */
  fileName: string
  /** Человекочитаемое название трека (алиас wikilink или текст markdown-ссылки) */
  label?: string
  /** Строка ссылки помечена как велотрек */
  isBike: boolean
  /** Точный фрагмент исходного текста для удаления из описания */
  rawText: string
}

export interface ParsedGpxTrack {
  name: string | null
  /** [lon, lat] */
  coordinates: Array<[number, number]>
  /** Суммарная длина по точкам трека, метры */
  distance: number
  /** Длительность по первой/последней метке времени, секунды */
  duration?: number
  /** Подписанные остановки и промежуточные отметки вдоль трека. */
  checkpoints: GpxCheckpoint[]
  /** Именованные точки вне трека, отображаемые отдельно от маршрута. */
  landmarks: GpxLandmark[]
}

interface GpxLandmark {
  name: string
  coordinates: [number, number]
}

interface GpxCheckpoint extends GpxLandmark {
  type: 'start' | 'via' | 'connect' | 'end'
}

const MAX_TRACK_POINTS = 1500
const EARTH_RADIUS_M = 6371000
const GENERIC_LABEL_RE = /^(?:gpx|трек|маршрут|велотрек|веломаршрут|карта|карты|maps?|trail)$/i

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const [lonA, latA] = a
  const [lonB, latB] = b
  const dLat = toRadians(latB - latA)
  const dLon = toRadians(lonB - lonA)
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, s)))
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : ''
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10)
      return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : ''
    })
    .replace(/&apos;/gi, '\'')
    .replace(/&quot;/gi, '"')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;/gi, '&')
}

function xmlText(value: string): string {
  return decodeXmlEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim()
}

function buildCheckpoints(coordinates: Array<[number, number]>, landmarks: GpxLandmark[]) {
  const cumulative = [0]
  for (let i = 1; i < coordinates.length; i++)
    cumulative.push(cumulative[i - 1] + haversineMeters(coordinates[i - 1], coordinates[i]))
  const distance = cumulative[cumulative.length - 1]
  const stops: Array<GpxLandmark & { progress: number, type: 'via' | 'connect' }> = []
  const detached: GpxLandmark[] = []
  for (const landmark of landmarks) {
    let nearest = { distance: Infinity, progress: 0 }
    for (let i = 1; i < coordinates.length; i++) {
      const a = coordinates[i - 1]
      const b = coordinates[i]
      const scale = Math.cos(toRadians(landmark.coordinates[1]))
      const dx = (b[0] - a[0]) * scale
      const dy = b[1] - a[1]
      const denominator = dx * dx + dy * dy
      const fraction = denominator === 0
        ? 0
        : Math.max(0, Math.min(1, (((landmark.coordinates[0] - a[0]) * scale * dx) + ((landmark.coordinates[1] - a[1]) * dy)) / denominator))
      const projected: [number, number] = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]
      const separation = haversineMeters(landmark.coordinates, projected)
      if (separation < nearest.distance)
        nearest = { distance: separation, progress: cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * fraction }
    }
    // Nearby landmarks are checkpoints; distant landmarks must not divert the recorded trail.
    if (nearest.distance <= 100) {
      if (!stops.some(stop => stop.name === landmark.name && haversineMeters(stop.coordinates, landmark.coordinates) < 5))
        stops.push({ ...landmark, progress: nearest.progress, type: 'via' })
    }
    else {
      detached.push(landmark)
    }
  }
  stops.sort((a, b) => a.progress - b.progress)
  const start = coordinates[0]
  const end = coordinates[coordinates.length - 1]
  const startName = stops.find(stop => haversineMeters(stop.coordinates, start) < 5)
  const endName = [...stops].reverse().find(stop => stop !== startName && haversineMeters(stop.coordinates, end) < 5)
  const intermediate = stops.filter(stop => stop !== startName && stop !== endName)
  // Unnamed tracks still get useful distance markers, capped at roughly twenty rows.
  if (stops.length === 0) {
    const interval = Math.max(1000, Math.ceil(distance / 20000) * 1000)
    let index = 1
    for (let progress = interval; progress < distance - 50; progress += interval) {
      while (index < cumulative.length - 1 && cumulative[index] < progress)
        index++
      const a = coordinates[index - 1]
      const b = coordinates[index]
      const fraction = (progress - cumulative[index - 1]) / (cumulative[index] - cumulative[index - 1])
      intermediate.push({ name: `${progress / 1000} км`, coordinates: [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction], progress, type: 'connect' })
    }
  }
  const checkpoints: GpxCheckpoint[] = [
    { name: startName?.name || 'Начало трека', coordinates: start, type: 'start' },
    ...intermediate.map(stop => ({ name: stop.name, coordinates: stop.coordinates, type: stop.type })),
    { name: endName?.name || 'Конец трека', coordinates: end, type: 'end' },
  ]
  return { checkpoints, landmarks: detached }
}

/**
 * Находит явные ссылки на .gpx-файлы вольта в тексте активности:
 * - Obsidian-эмбеды и wikilink'и: `![[трек.gpx]]`, `[[трек.gpx|Название]]`
 * - markdown-ссылки на локальный файл: `[Название](путь/трек.gpx)`
 * - «голые» упоминания имени файла (строка вида `**GPX-трек**: chinan.gpx`)
 */
export function extractGpxReferences(text: string): GpxReference[] {
  const refs: GpxReference[] = []
  const covered: Array<[number, number]> = []

  const lineAt = (index: number): string => {
    const start = text.lastIndexOf('\n', index - 1) + 1
    const end = text.indexOf('\n', index)
    return text.slice(start, end === -1 ? text.length : end)
  }

  const push = (fileName: string, label: string | undefined, rawText: string, index: number) => {
    const cleanLabel = label?.trim() || undefined
    refs.push({
      fileName: fileName.trim(),
      label: cleanLabel && !GENERIC_LABEL_RE.test(cleanLabel) && !/\.gpx$/i.test(cleanLabel)
        ? cleanLabel
        : undefined,
      isBike: /вело|bike/i.test(lineAt(index)),
      rawText,
    })
  }

  // 1. Obsidian-эмбеды и wikilink'и
  for (const match of text.matchAll(/!?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g)) {
    if (!/\.gpx$/i.test(match[1].trim()))
      continue
    push(match[1], match[2], match[0], match.index)
    covered.push([match.index, match.index + match[0].length])
  }

  // 2. Markdown-ссылки на локальный .gpx
  for (const match of text.matchAll(/\[([^\]]*)\]\(([^()\n]*?\.gpx)\)/gi)) {
    covered.push([match.index, match.index + match[0].length])
    if (/^https?:\/\//i.test(match[2].trim()))
      continue
    push(match[2], match[1], match[0], match.index)
  }

  // 3. «Голые» упоминания имени файла вне уже обработанных ссылок
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi))
    covered.push([match.index, match.index + match[0].length])
  for (const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N} _\-./()]*\.gpx/giu)) {
    const raw = match[0]
    if (raw.includes('://'))
      continue
    if (covered.some(([start, end]) => match.index >= start && match.index < end))
      continue
    push(raw, undefined, raw, match.index)
    covered.push([match.index, match.index + raw.length])
  }

  return refs
}

/**
 * Разбирает содержимое GPX 1.0/1.1 (треки `trkpt`, маршрутные точки `rtept`, путевые `wpt`)
 * без XML-библиотек: только координаты, имя и метки времени.
 */
export function parseGpxContent(content: string): ParsedGpxTrack | null {
  const coordinates: Array<[number, number]> = []
  const landmarks: GpxLandmark[] = []
  // Waypoints describe landmarks, not the track's geometry. Prefer recorded
  // track points, then route points; never join both to unrelated landmarks.
  const pointTag = /<trkpt\b/i.test(content) ? 'trkpt' : /<rtept\b/i.test(content) ? 'rtept' : 'wpt'
  for (const match of content.matchAll(/<(trkpt|rtept|wpt)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi)) {
    const attrs = match[2]
    const lat = attrs.match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]
    const lon = attrs.match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!lat || !lon)
      continue
    const lonNum = Number(lon)
    const latNum = Number(lat)
    if (!Number.isFinite(lonNum) || !Number.isFinite(latNum) || Math.abs(lonNum) > 180 || Math.abs(latNum) > 90)
      continue
    if (match[1].toLowerCase() === pointTag)
      coordinates.push([lonNum, latNum])
    const name = xmlText(match[3]?.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1] || '')
    if (name)
      landmarks.push({ name, coordinates: [lonNum, latNum] })
  }

  if (coordinates.length < 2)
    return null

  // Имя трека: предпочитаем <trk><name>, затем <metadata><name>
  const trkName = content.match(/<(?:trk|rte)\b[^>]*>((?:(?!<(?:trkseg|trkpt|rtept|extensions)\b)[\s\S])*?)<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[2]
  const metaName = content.match(/<metadata\b[^>]*>\s*<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1]
  const name = xmlText(trkName || metaName || '')
    .replace(/^Wikiloc\s*-\s*/i, '')
    .replace(/\s*-\s*Wikiloc$/i, '')
    .trim() || null

  // Distance must use the original samples, before display simplification.
  let distance = 0
  for (let i = 1; i < coordinates.length; i++)
    distance += haversineMeters(coordinates[i - 1], coordinates[i])

  // Прореживание очень плотных треков, чтобы не раздувать payload геолокации
  let points = coordinates
  if (points.length > MAX_TRACK_POINTS) {
    points = Array.from({ length: MAX_TRACK_POINTS }, (_, i) =>
      coordinates[Math.round(i * (coordinates.length - 1) / (MAX_TRACK_POINTS - 1))])
  }

  // Длительность только по меткам времени точек трека: <time> в <metadata>
  // (дата экспорта) не должен влиять на хронометраж.
  const trkptTimes: number[] = []
  for (const match of content.matchAll(/<trkpt\b[^>]*>[\s\S]*?<\/trkpt>/gi)) {
    const time = match[0].match(/<time>([^<]*)<\/time>/i)?.[1]
    if (!time)
      continue
    const ms = Date.parse(time)
    if (!Number.isNaN(ms))
      trkptTimes.push(ms)
  }
  let duration: number | undefined
  if (trkptTimes.length >= 2) {
    const seconds = Math.round((trkptTimes.reduce((max, time) => Math.max(max, time), -Infinity) - trkptTimes.reduce((min, time) => Math.min(min, time), Infinity)) / 1000)
    if (seconds > 0)
      duration = seconds
  }

  return { name, coordinates: points, distance, duration, ...buildCheckpoints(coordinates, landmarks) }
}

export function parseGpxFile(filePath: string): ParsedGpxTrack | null {
  try {
    return parseGpxContent(readFileSync(filePath, 'utf8'))
  }
  catch {
    return null
  }
}

/**
 * Резолвит ссылку на .gpx по индексу файлов вольта (полный относительный путь,
 * basename, регистронезависимо; пустая строка — признак неоднозначного basename).
 */
export function resolveGpxFile(fileName: string, index: Map<string, string>): string | null {
  let decoded = fileName
  try {
    decoded = decodeURIComponent(fileName)
  }
  catch {
    // An invalid escape should behave like a literal filename.
  }
  const normalized = decoded.replace(/\\/g, '/').replace(/^\.\//, '').trim()
  const keys = [normalized, normalized.toLowerCase()]
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key))
      continue
    seen.add(key)
    const hit = index.get(key)
    if (hit)
      return hit
    if (hit === '')
      return null
  }

  const suffix = `/${normalized.toLowerCase()}`
  const matches = new Set<string>()
  for (const [key, value] of index) {
    if (value && key.toLowerCase().endsWith(suffix))
      matches.add(value)
  }
  return matches.size === 1 ? [...matches][0] : null
}
