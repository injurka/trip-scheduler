import type { TripDocumentResponse, TripNote } from '../src/renderer/shared/services/api/model/types'
import type { TripMedia, TripWithDays } from '../src/renderer/shared/types/models/trip'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { memoryCaches, MemoryStorage } from './helpers/offline-browser'

let notes: TripNote[] = []
let documents: TripDocumentResponse[] = []
let media: TripMedia[] = []
let tileUrls: string[] = []
let failedUrl = ''
let content = 'first'
let fetched: string[] = []
const warnings: string[] = []
const toast = {
  success() {},
  info() {},
  error() {},
  warn(message: string) {
    warnings.push(message)
  },
}
mock.module('~/shared/composables/use-toast', () => ({ useToast: () => toast }))
mock.module('~/shared/services/trpc/trpc.service', () => ({
  trpc: {
    note: { getByTripId: { query: async () => notes } },
    image: { listDocuments: { query: async () => documents }, listByTrip: { query: async () => media } },
  },
}))
mock.module('~/shared/lib/offline-map', () => ({ planOfflineMap: async () => tileUrls }))
const { useOfflineStore } = await import('../src/renderer/shared/store/offline.store')
const { findOfflineMediaResponse } = await import('../src/renderer/shared/lib/offline-cache')
let cache = memoryCaches()
function trip(): TripWithDays {
  return {
    id: 'trip',
    userId: 'alice',
    title: 'Taiwan',
    imageUrl: 'https://example.test/cover.jpg',
    days: [],
    sections: [],
  } as unknown as TripWithDays
}
function account(id: string) {
  localStorage.setItem('auth_user', JSON.stringify({ id }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  cache = memoryCaches()
  notes = []
  documents = []
  media = []
  tileUrls = []
  fetched = []
  failedUrl = ''
  content = 'first'
  warnings.length = 0
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cache.api })
  globalThis.fetch = mock(async (input: string | Request | URL) => {
    const url = String(input)
    fetched.push(url)

    return new Response(content, { status: url === failedUrl ? 503 : 200 })
  }) as unknown as typeof fetch
  account('alice')
})

describe('offline downloads', () => {
  it('downloads note attachments independently of general media', async () => {
    notes = [{ id: 'note', content: '![photo](https://example.test/note.jpg)', images: [{ sources: { small: 'https://example.test/small.jpg' } }] }] as unknown as TripNote[]
    const store = useOfflineStore()
    await store.saveTripForOffline(trip(), { includeMedia: false, includeNotes: true, includeDocuments: false })
    expect(fetched.sort()).toEqual(['https://example.test/note.jpg', 'https://example.test/small.jpg'])
    expect(store.getSavedTripNotes('trip')).toHaveLength(1)
  })
  it('downloads booking photos and gallery variants', async () => {
    const data = trip()
    data.sections = [{ type: 'bookings', content: { bookings: [{ type: 'hotel', data: { photos: ['https://example.test/hotel.jpg'] } }] } }] as unknown as TripWithDays['sections']
    media = [{ url: 'https://example.test/original.jpg', variants: { medium: 'https://example.test/medium.webp', thumbhash: 'not-a-url' } }] as TripMedia[]
    await useOfflineStore().saveTripForOffline(data, { includeNotes: false, includeDocuments: false })
    expect(fetched).toContain('https://example.test/hotel.jpg')
    expect(fetched).toContain('https://example.test/medium.webp')
    expect(fetched).not.toContain('not-a-url')
  })
  it('refreshes files at the same URL and removes the replaced cache', async () => {
    const store = useOfflineStore()
    await store.saveTripForOffline(trip())
    const first = store.savedTrips.trip.cacheName!
    content = 'second'
    await store.saveTripForOffline(trip())
    expect(await (await findOfflineMediaResponse(trip().imageUrl!))?.text()).toBe('second')
    expect(cache.data.has(first)).toBe(false)
    expect(fetched.filter(url => url === trip().imageUrl)).toHaveLength(2)
  })
  it('retains a previously selected category when refreshing another category', async () => {
    const store = useOfflineStore()
    await store.saveTripForOffline(trip())
    await store.saveTripForOffline(trip(), { includeMedia: false, includeNotes: true, includeDocuments: false })
    expect(await findOfflineMediaResponse(trip().imageUrl!)).not.toBeNull()
  })
  it('deletes all files of one copy without deleting another trip', async () => {
    const store = useOfflineStore()
    await store.saveTripForOffline(trip())
    await store.saveTripForOffline({ ...trip(), id: 'other' })
    const removed = store.savedTrips.trip.cacheName!
    const retained = store.savedTrips.other.cacheName!
    await store.removeOfflineTrip('trip')
    expect(cache.data.has(removed)).toBe(false)
    expect(cache.data.has(retained)).toBe(true)
    store.$reset()
    await store.initStorage()
    expect(store.isTripCached('trip')).toBe(false)
  })
  it('isolates snapshots and cached private files between accounts', async () => {
    const store = useOfflineStore()
    await store.saveTripForOffline(trip())
    account('bob')
    await store.initStorage()
    expect(store.sortedSavedTrips).toEqual([])
    expect(await findOfflineMediaResponse(trip().imageUrl!)).toBeNull()
    account('alice')
    await store.initStorage()
    expect(store.isTripCached('trip')).toBe(true)
    expect(await findOfflineMediaResponse(trip().imageUrl!)).not.toBeNull()
  })
  it('removes deleted note/document files when the server returns empty lists', async () => {
    notes = [{ id: 'note', content: '![photo](https://example.test/removed.jpg)' }] as unknown as TripNote[]
    documents = [{ id: 'doc', url: 'https://example.test/removed.pdf' }] as TripDocumentResponse[]
    const store = useOfflineStore()
    await store.saveTripForOffline(trip())
    expect(await findOfflineMediaResponse('https://example.test/removed.jpg')).not.toBeNull()
    notes = []
    documents = []
    await store.saveTripForOffline(trip())
    expect(store.getSavedTripNotes('trip')).toEqual([])
    expect(store.getSavedTripDocuments('trip')).toEqual([])
    expect(await findOfflineMediaResponse('https://example.test/removed.jpg')).toBeNull()
    expect(await findOfflineMediaResponse('https://example.test/removed.pdf')).toBeNull()
  })
  it('discards an in-flight download when the account changes', async () => {
    const started = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    globalThis.fetch = mock(() => {
      started.resolve()

      return response.promise
    }) as unknown as typeof fetch
    const store = useOfflineStore()
    const saving = store.saveTripForOffline(trip())
    await started.promise
    account('bob')
    await store.initStorage()
    response.resolve(new Response('private content'))
    await saving
    expect(store.sortedSavedTrips).toEqual([])
    expect(await caches.keys()).toEqual([])
    account('alice')
    await store.initStorage()
    expect(store.isTripCached('trip')).toBe(false)
  })
  it('marks map ready only when every planned resource succeeds', async () => {
    tileUrls = ['https://example.test/map/0', 'https://example.test/map/1']
    failedUrl = tileUrls[1]
    const store = useOfflineStore()
    await store.saveTripForOffline(trip(), { includeMapTiles: true })
    expect(store.savedTrips.trip.includesTiles).toBe(false)
    expect(warnings).toHaveLength(1)
    failedUrl = ''
    await store.saveTripForOffline(trip(), { includeMapTiles: true })
    expect(store.savedTrips.trip.includesTiles).toBe(true)
  })
})
