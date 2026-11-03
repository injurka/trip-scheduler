import type { TripWithDays } from '../src/renderer/shared/types/models/trip'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { memoryCaches, MemoryStorage } from './helpers/offline-browser'

mock.module('~/shared/lib/map-styles-sources', () => ({
  getEffectiveMapTilerKey: () => '',
  getCustomTileUrl: () => '',
  getMapStyle: () => 'https://maps.example.test/style.json',
}))
const { getOfflineRouteTiles, planOfflineMap } = await import('../src/renderer/shared/lib/offline-map')
const { getTilesForBBox, lngLatToTile } = await import('../src/renderer/shared/lib/tile-calc')
let cache = memoryCaches()
function trip(geometry = [[121.5, 25.0], [120.3, 22.6]]): TripWithDays {
  return { sections: [{ type: 'geolocation', content: { routes: [{ geometry }] } }], days: [] } as unknown as TripWithDays
}
beforeEach(() => {
  cache = memoryCaches()
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cache.api })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input)

    return Response.json(url.endsWith('style.json')
      ? { sources: { vector: { type: 'vector', url: 'https://maps.example.test/data.json' } }, sprite: 'https://maps.example.test/sprite?key=test', glyphs: 'https://maps.example.test/fonts/{fontstack}/{range}.pbf', layers: [{ layout: { 'text-font': ['Noto Sans Regular'] } }] }
      : { minzoom: 0, maxzoom: 15, tiles: ['https://maps.example.test/vector/{z}/{x}/{y}.pbf'] })
  }) as unknown as typeof fetch
})

describe('offline map coverage and dependencies', () => {
  it('covers all zooms including detailed route tiles in Taiwan without stopping at zoom 12', () => {
    const tiles = getOfflineRouteTiles(trip())
    expect(new Set(tiles.map(tile => tile.z)).size).toBe(16)

    for (const [lng, lat] of [[121.5, 25.0], [120.3, 22.6]]) {
      const tile = lngLatToTile(lng, lat, 15)
      expect(tiles).toContainEqual({ z: 15, ...tile })
    }

    const midpoint = lngLatToTile(120.9, 23.8, 15)
    expect(tiles.some(tile => tile.z === 15 && Math.abs(tile.x - midpoint.x) <= 1 && Math.abs(tile.y - midpoint.y) <= 2)).toBe(true)
  })
  it('throws explicitly on a resource limit rather than returning partial coverage', () => {
    expect(() => getTilesForBBox(
      { minLng: 120, maxLng: 122, minLat: 22, maxLat: 25 },
      10,
      15,
      450,
    )).toThrow('лимит')
  })
  it('loads actual TileJSON endpoints, font ranges and both sprite resolutions', async () => {
    const urls = await planOfflineMap(trip([[121.5, 25]]), 'map-test')
    expect(urls.some(url => url.includes('/vector/15/'))).toBe(true)
    expect(urls.some(url => url.includes('/maps/streets-v4/'))).toBe(false)
    expect(urls).toContain('https://maps.example.test/sprite@2x.png?key=test')
    expect(urls).toContain('https://maps.example.test/fonts/Noto%20Sans%20Regular/19968-20223.pbf')
    expect(cache.data.get('map-test')?.has('https://maps.example.test/data.json')).toBe(true)
  })
})
