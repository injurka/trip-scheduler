import type { TripWithDays } from '~/shared/types/models/trip'
import { isRecord } from '@injurka/type-utils'
import { normalizeMapResource } from './map-resource'
import { getCustomTileUrl, getEffectiveMapTilerKey, getMapStyle } from './map-styles-sources'
import { calculateTripBoundingBox, getTilesForBBox, lngLatToTile } from './tile-calc'

const MAX_RESOURCES = 50000

/** Full overview plus detailed 3x3-tile areas along the actual route, without silent truncation. */
export function getOfflineRouteTiles(trip: TripWithDays) {
  const bounds = calculateTripBoundingBox(trip)

  if (!bounds)
    throw new Error('В маршруте нет координат для оффлайн-карты.')

  const tiles = new Map<string, { z: number, x: number, y: number }>()
  const add = (z: number, x: number, y: number) => {
    const last = 2 ** z - 1

    if (x < 0 || y < 0 || x > last || y > last)
      return

    tiles.set(`${z}/${x}/${y}`, { z, x, y })

    if (tiles.size > MAX_RESOURCES)
      throw new Error('Маршрут слишком большой для одной оффлайн-карты. Разделите его на несколько поездок.')
  }

  for (const tile of getTilesForBBox(
    bounds,
    0,
    10,
    MAX_RESOURCES,
  ))
    add(tile.z, tile.x, tile.y)

  const coordinate = (value: unknown): value is [number, number] => Array.isArray(value)
    && typeof value[0] === 'number' && typeof value[1] === 'number'
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 85
  const point = (value: [number, number], previous?: [number, number]) => {
    for (let z = 11; z <= 15; z++) {
      const end = lngLatToTile(value[0], value[1], z)
      const start = previous ? lngLatToTile(previous[0], previous[1], z) : end
      const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y), 1)

      for (let step = 0; step <= steps; step++) {
        const x = Math.round(start.x + (end.x - start.x) * step / steps)
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

function addGlyphs(data: Record<string, unknown>, base: string, urls: Set<string>) {
  if (typeof data.glyphs !== 'string' || !Array.isArray(data.layers))
    return

  const fonts = new Set<string>()

  for (const layer of data.layers) {
    if (isRecord(layer) && isRecord(layer.layout)) {
      const font = layer.layout['text-font'] ?? ['Open Sans Regular', 'Arial Unicode MS Regular']
      collectFonts(font, fonts)
    }
  }

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

function getStylesToSave() {
  const sources: ('maptilerStreets' | 'maptilerOutdoor' | 'satellite' | 'custom')[] = ['maptilerStreets', 'maptilerOutdoor']

  if (getCustomTileUrl())
    sources.push('custom')

  if (typeof localStorage !== 'undefined' && localStorage.getItem('app-settings-active-tile-source')?.includes('satellite'))
    sources.push('satellite')

  return sources
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
export async function planOfflineMap(trip: TripWithDays, cacheName: string): Promise<string[]> {
  const tiles = getOfflineRouteTiles(trip)
  const cache = await caches.open(cacheName)
  const urls = new Set<string>()
  const json: JsonLoader = async (url) => {
    const response = await fetch(url, { cache: 'reload', signal: AbortSignal.timeout(30000) })

    if (!response.ok)
      throw new Error(`Не удалось загрузить описание карты (${response.status}).`)

    const data = normalizeMapResource(await response.clone().json(), url)
    urls.add(url)
    await cache.put(url, Response.json(data))

    if (!isRecord(data))
      throw new Error('Некорректное описание карты.')

    return data
  }

  for (const id of getStylesToSave()) {
    await addStyle(
      getMapStyle(id),
      json,
      tiles,
      urls,
    )
  }

  const key = getEffectiveMapTilerKey()

  if (key) {
    await addSource(
      { url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`, maxzoom: 14 },
      'https://api.maptiler.com/',
      json,
      tiles,
      urls,
    )
  }

  if (urls.size > MAX_RESOURCES)
    throw new Error('Слишком много ресурсов карты. Разделите маршрут на несколько поездок.')

  return [...urls]
}
