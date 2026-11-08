import type { OfflineMapOptions } from './offline-map-options'
import type { TripWithDays } from '~/shared/types/models/trip'
import { isRecord } from '@injurka/type-utils'
import { onlineFetch } from '~/shared/lib/connectivity'
import { normalizeMapResource } from './map-resource'
import { getEffectiveMapTilerKey, getMapStyle } from './map-styles-sources'
import { getOfflineMapStyle, getSelectedMapAreas } from './offline-map-options'
import { calculateTripBoundingBox, lngLatToTile } from './tile-calc'

/** A deduplicated corridor at every selected zoom; no bounding rectangle across distant regions. */
export function getOfflineRouteTiles(trip: TripWithDays, maxZoom = 15) {
  const bounds = calculateTripBoundingBox(trip)

  if (!bounds)
    throw new Error('В маршруте нет координат для оффлайн-карты.')

  const tiles = new Map<string, { z: number, x: number, y: number }>()
  const add = (z: number, x: number, y: number) => {
    const last = 2 ** z - 1

    if (y < 0 || y > last)
      return

    const wrappedX = ((x % (last + 1)) + last + 1) % (last + 1)
    tiles.set(`${z}/${wrappedX}/${y}`, { z, x: wrappedX, y })
  }

  const coordinate = (value: unknown): value is [number, number] => Array.isArray(value)
    && typeof value[0] === 'number' && typeof value[1] === 'number'
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 85
  const point = (value: [number, number], previous?: [number, number]) => {
    for (let z = 0; z <= maxZoom; z++) {
      const end = lngLatToTile(value[0], value[1], z)
      const start = previous ? lngLatToTile(previous[0], previous[1], z) : end
      let deltaX = end.x - start.x

      if (Math.abs(deltaX) > 2 ** z / 2)
        deltaX -= Math.sign(deltaX) * 2 ** z

      const steps = Math.max(Math.abs(deltaX), Math.abs(end.y - start.y), 1)

      for (let step = 0; step <= steps; step++) {
        const x = Math.round(start.x + deltaX * step / steps)
        const y = Math.round(start.y + (end.y - start.y) * step / steps)

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++)
            add(z, x + dx, y + dy)
        }
      }
    }
  }
  const walkArray = (values: unknown[], connected: boolean) => {
    let previous: [number, number] | undefined

    for (const item of values) {
      if (connected && coordinate(item)) {
        point(item, previous)
        previous = item
      }
      else {
        walk(item, connected)
      }
    }
  }
  function walk(value: unknown, connected = false) {
    if (coordinate(value)) {
      point(value)

      return
    }

    if (Array.isArray(value)) {
      walkArray(value, connected)
    }
    else if (isRecord(value)) {
      const location = [value.lon, value.lat]

      if (coordinate(location))
        point(location)

      for (const [key, item] of Object.entries(value)) {
        if (['coordinates', 'geometry', 'points', 'routes', 'center', 'location', 'content', 'sections', 'days', 'activities', 'bookings', 'data'].includes(key))
          walk(item, key === 'geometry' || key === 'coordinates')
      }
    }
  }
  walk(trip)

  return [...tiles.values()]
}

function resourceUrl(url: string, base: string): string {
  return new URL(url, base).toString()
}

type JsonLoader = (url: string) => Promise<Record<string, unknown>>
interface Tile { z: number, x: number, y: number }

function addSourceTiles(
  metadata: Record<string, unknown>,
  base: string,
  tiles: Tile[],
  urls: Set<string>,
) {
  if (!Array.isArray(metadata.tiles))
    return

  const minZoom = typeof metadata.minzoom === 'number' ? metadata.minzoom : 0
  const maxZoom = typeof metadata.maxzoom === 'number' ? metadata.maxzoom : 15

  for (const tile of tiles) {
    if (tile.z < minZoom || tile.z > maxZoom)
      continue

    const y = metadata.scheme === 'tms' ? 2 ** tile.z - 1 - tile.y : tile.y

    for (const template of metadata.tiles) {
      if (typeof template === 'string')
        urls.add(resourceUrl(template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(y)).replace('{ratio}', ''), base))
    }
  }
}

function collectFonts(value: unknown, fonts: Set<string>) {
  if (!Array.isArray(value))
    return

  if (value.length && value.every(item => typeof item === 'string') && !['literal', 'get', 'coalesce', 'case', 'match', 'step'].includes(value[0])) {
    fonts.add(value.join(','))

    return
  }

  value.forEach(item => collectFonts(item, fonts))
}

function getLayerFont(layer: unknown): unknown {
  if (!isRecord(layer) || !isRecord(layer.layout))
    return undefined

  if (!('text-font' in layer.layout) && !('text-field' in layer.layout))
    return undefined

  return layer.layout['text-font'] ?? ['Open Sans Regular', 'Arial Unicode MS Regular']
}

function addGlyphs(data: Record<string, unknown>, base: string, urls: Set<string>) {
  if (typeof data.glyphs !== 'string' || !Array.isArray(data.layers))
    return

  const fonts = new Set<string>()

  for (const layer of data.layers)
    collectFonts(getLayerFont(layer), fonts)

  for (const font of fonts) {
    for (let start = 0; start < 65536; start += 256)
      urls.add(resourceUrl(data.glyphs.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', `${start}-${start + 255}`), base))
  }
}

function addSprites(data: Record<string, unknown>, base: string, urls: Set<string>) {
  if (typeof data.sprite !== 'string')
    return

  for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
    const url = new URL(resourceUrl(data.sprite, base))
    url.pathname += suffix
    urls.add(url.toString())
  }
}

async function addSource(
  source: Record<string, unknown>,
  base: string,
  json: JsonLoader,
  tiles: Tile[],
  urls: Set<string>,
) {
  if (source.type === 'geojson' && typeof source.data === 'string')
    urls.add(resourceUrl(source.data, base))

  const metadata = typeof source.url === 'string'
    ? { ...await json(resourceUrl(source.url, base)), ...source }
    : source
  addSourceTiles(
    metadata,
    base,
    tiles,
    urls,
  )
}

async function addStyle(
  style: ReturnType<typeof getMapStyle>,
  json: JsonLoader,
  tiles: Tile[],
  urls: Set<string>,
) {
  const base = typeof style === 'string' ? style : 'https://a.tile.openstreetmap.org/'
  const data = typeof style === 'string' ? await json(style) : style

  if (isRecord(data.sources)) {
    for (const source of Object.values(data.sources)) {
      if (isRecord(source)) {
        await addSource(
          source,
          base,
          json,
          tiles,
          urls,
        )
      }
    }
  }

  addSprites(data, base, urls)
  addGlyphs(data, base, urls)
}

/** Resolve real style/TileJSON dependencies rather than inventing vector tile endpoints. */
export async function planOfflineMap(
  trip: TripWithDays,
  cacheName: string,
  options: OfflineMapOptions = {},
  refreshedMetadata = new Set<string>(),
): Promise<string[]> {
  const tiles = getOfflineRouteTiles(trip, options.maxZoom ?? 15)
  const cache = await caches.open(cacheName)
  const urls = new Set<string>()
  const json: JsonLoader = async (url) => {
    const cached = options.refresh && !refreshedMetadata.has(url) ? undefined : await cache.match(url)
    const response = cached ?? await onlineFetch(url, { cache: 'reload', signal: AbortSignal.timeout(30000) })

    if (!response.ok)
      throw new Error(`Не удалось загрузить описание карты (${response.status}).`)

    const data = normalizeMapResource(await response.clone().json(), url)
    urls.add(url)
    await cache.put(url, Response.json(data))
    refreshedMetadata.add(url)

    if (!isRecord(data))
      throw new Error('Некорректное описание карты.')

    return data
  }

  await addStyle(
    getMapStyle(options.style ?? getOfflineMapStyle()),
    json,
    tiles,
    urls,
  )

  const key = getEffectiveMapTilerKey()

  if (key && options.terrain) {
    await addSource(
      { url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`, maxzoom: 14 },
      'https://api.maptiler.com/',
      json,
      tiles,
      urls,
    )
  }

  return [...urls]
}

/** Approximate transfer size: provider payloads vary, so present a range, not an exact promise. */
export function estimateOfflineMap(trip: TripWithDays, options: OfflineMapOptions) {
  const areas = getSelectedMapAreas(trip, options)
  const tileCount = areas.reduce((total, area) => total + getOfflineRouteTiles(area.trip, options.maxZoom ?? 15).length, 0)
  const multiplier = options.terrain ? 2 : 1

  return {
    areaCount: areas.length,
    tileCount,
    minBytes: tileCount * 8 * 1024 * multiplier + 1024 * 1024,
    maxBytes: tileCount * 80 * 1024 * multiplier + 20 * 1024 * 1024,
  }
}
