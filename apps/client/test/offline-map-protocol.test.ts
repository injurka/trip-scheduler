import type { AddProtocolAction } from 'maplibre-gl'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { memoryCaches, MemoryStorage } from './helpers/offline-browser'

let handler: AddProtocolAction | undefined
mock.module('maplibre-gl', () => ({
  addProtocol: (_name: string, action: AddProtocolAction) => {
    handler = action
  },
}))
const { getMaplibreTransformRequest } = await import('../src/renderer/shared/lib/map-tile-cache')
const { getOfflineCachePrefix, OFFLINE_CACHE_READY_URL } = await import('../src/renderer/shared/lib/offline-cache')
let cache = memoryCaches()
beforeEach(() => {
  cache = memoryCaches()
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cache.api })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
  localStorage.setItem('auth_user', JSON.stringify({ id: 'alice' }))
  globalThis.fetch = mock(async () => {
    throw new Error('offline')
  }) as unknown as typeof fetch
})

async function save(url: string, response: Response) {
  const saved = await caches.open(`${getOfflineCachePrefix('alice')}trip-test`)
  await saved.put(OFFLINE_CACHE_READY_URL, Response.json({ savedAt: 1 }))
  await saved.put(url, response)
}

describe('map protocol without service workers', () => {
  it('reads saved TileJSON offline and preserves the original base for relative URLs', async () => {
    const url = 'https://tiles.example.test/data/tiles.json'
    await save(url, Response.json({ tiles: ['./{z}/{x}/{y}.pbf'] }))
    const transform = getMaplibreTransformRequest()
    const request = transform(url)
    expect(request.url).toBe(`trip-cache://${url}`)
    const result = await handler!({ ...request, type: 'json' }, new AbortController())
    expect(result.data).toEqual({ tiles: ['https://tiles.example.test/data/{z}/{x}/{y}.pbf'] })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('reads binary map resources on Web/native and canonicalises OSM subdomains', async () => {
    const url = 'https://a.tile.openstreetmap.org/10/1/2.png'
    await save(url, new Response(new Uint8Array([1, 2, 3])))
    const request = getMaplibreTransformRequest()('https://c.tile.openstreetmap.org/10/1/2.png')
    const result = await handler!({ ...request, type: 'arrayBuffer' }, new AbortController())
    expect([...new Uint8Array(result.data)]).toEqual([1, 2, 3])
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not expose another account cache when the network is unavailable', async () => {
    const url = 'https://tiles.example.test/private.json'
    await save(url, Response.json({ secret: true }))
    localStorage.setItem('auth_user', JSON.stringify({ id: 'bob' }))
    const request = getMaplibreTransformRequest()(url)
    await expect(handler!({ ...request, type: 'json' }, new AbortController())).rejects.toThrow('offline')
  })
})
