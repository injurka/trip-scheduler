import type { OfflineMapCoverage, OfflineMapOptions } from '../src/renderer/shared/lib/offline-map-options'
import type { TripWithDays } from '../src/renderer/shared/types/models/trip'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { memoryCaches, MemoryStorage } from './helpers/offline-browser'

mock.module('~/shared/lib/offline-map', () => ({ planOfflineMap: async (trip: TripWithDays) => ['https://maps.test/shared.pbf', `https://maps.test/${trip.days[0].id}.pbf`] }))
const { downloadOfflineMapAreas } = await import('../src/renderer/shared/lib/offline-map-download')
const { OFFLINE_CACHE_READY_URL } = await import('../src/renderer/shared/lib/offline-cache')
const trip = {
  id: 'trip',
  sections: [],
  days: ['day-1', 'day-2'].map(id => ({ id, title: id, activities: [{ sections: [{ type: 'geolocation', points: [{ coordinates: [121, 25] }] }] }] })),
} as unknown as TripWithDays
let cache = memoryCaches()
let failedUrl = ''
let fetched: string[] = []
let checkpoints: OfflineMapCoverage[] = []
const options: OfflineMapOptions = { maxZoom: 12, style: 'osm' }

beforeEach(() => {
  cache = memoryCaches()
  failedUrl = ''
  fetched = []
  checkpoints = []
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cache.api })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
  localStorage.setItem('auth_user', JSON.stringify({ id: 'alice' }))
  globalThis.fetch = mock(async (url: string | URL | Request) => {
    fetched.push(String(url))

    return new Response('tile', { status: String(url) === failedUrl ? 503 : 200 })
  }) as unknown as typeof fetch
})
async function download(settings = options) {
  return downloadOfflineMapAreas(
    trip,
    'test-map',
    'alice',
    settings,
    () => {},
    async (coverage) => { checkpoints.push(coverage) },
  )
}

describe('incremental map downloads within one trip', () => {
  it('shares common resources and checkpoints each finished area', async () => {
    const result = await download()
    expect(result.completedAreas).toBe(2)
    expect(checkpoints.map(area => area.areaId)).toEqual(['day-1', 'day-2'])
    expect(fetched.filter(url => url.endsWith('shared.pbf'))).toHaveLength(1)
    expect(cache.data.get('test-map')?.has(OFFLINE_CACHE_READY_URL)).toBe(true)
  })
  it('keeps completed areas and retries only missing resources', async () => {
    failedUrl = 'https://maps.test/day-2.pbf'
    expect((await download()).failedAreas).toBe(1)
    expect(checkpoints.map(area => area.areaId)).toEqual(['day-1'])
    failedUrl = ''
    fetched = []
    const result = await download()
    expect(result.failedAreas).toBe(0)
    expect(fetched).toEqual(['https://maps.test/day-2.pbf'])
  })
  it('downloads a chosen day without fetching other areas', async () => {
    await download({ ...options, areaIds: ['day-2'] })
    expect(fetched).not.toContain('https://maps.test/day-1.pbf')
    expect(checkpoints).toHaveLength(1)
    expect(checkpoints[0].maxZoom).toBe(12)
  })
  it('allows explicitly refreshing already saved resources', async () => {
    await download()
    fetched = []
    await download({ ...options, refresh: true })
    expect(fetched).toContain('https://maps.test/day-1.pbf')
    expect(fetched).toContain('https://maps.test/day-2.pbf')
    expect(fetched.filter(url => url.endsWith('shared.pbf'))).toHaveLength(1)
  })
  it('preserves checkpoints on storage exhaustion and does not suggest splitting the trip', async () => {
    const open = cache.api.open.bind(cache.api)
    cache.api.open = async (name) => {
      const saved = await open(name)
      const put = saved.put.bind(saved)
      saved.put = async (request, response) => {
        if (String(request).endsWith('day-2.pbf'))
          throw new DOMException('Full', 'QuotaExceededError')

        return put(request, response)
      }

      return saved
    }
    await expect(download()).rejects.toThrow('Скачанные участки сохранены')
    expect(checkpoints.map(area => area.areaId)).toEqual(['day-1'])
    expect(cache.data.get('test-map')?.has('https://maps.test/day-1.pbf')).toBe(true)
  })
})
