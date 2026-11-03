import type { OfflineTripEntry } from '../src/renderer/shared/store/offline.store'
import { beforeEach, describe, expect, it } from 'bun:test'
import { OfflineStorageService } from '../src/renderer/shared/services/offline/offline-storage.service'
import { MemoryStorage } from './helpers/offline-browser'

function entry(account: string): OfflineTripEntry {
  return { id: 'same-trip', downloadedByUserId: account, data: { id: 'same-trip', userId: 'owner' }, title: account } as OfflineTripEntry
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
})

describe('offline persistent storage fallback', () => {
  it('keeps localStorage across repeated reads when IndexedDB is unavailable', async () => {
    const service = new OfflineStorageService()
    await service.saveTrip(entry('alice'))
    expect((await service.loadAllTrips('alice'))['same-trip'].title).toBe('alice')
    expect((await service.loadAllTrips('alice'))['same-trip'].title).toBe('alice')
    expect(localStorage.getItem('offline-trips-data')).not.toBeNull()
  })
  it('does not delete another account legacy copy when removing a scoped copy', async () => {
    const legacy = { ...entry('alice'), downloadedByUserId: undefined, data: { id: 'same-trip', userId: 'alice' } }
    localStorage.setItem('offline-trips-data', JSON.stringify({ 'same-trip': legacy }))
    const service = new OfflineStorageService()
    await service.saveTrip(entry('bob'))
    await service.removeTrip('same-trip', 'bob')
    expect((await service.loadAllTrips('alice'))['same-trip'].title).toBe('alice')
    expect(await service.loadAllTrips('bob')).toEqual({})
  })
  it('stores separate copies of the same trip for different downloaders', async () => {
    const service = new OfflineStorageService()
    await service.saveTrip(entry('alice'))
    await service.saveTrip(entry('bob'))
    expect((await service.loadAllTrips('alice'))['same-trip'].title).toBe('alice')
    expect((await service.loadAllTrips('bob'))['same-trip'].title).toBe('bob')
    expect(await service.loadAllTrips(null)).toEqual({})
    await service.removeTrip('same-trip', 'alice')
    expect(await service.loadAllTrips('alice')).toEqual({})
    expect((await service.loadAllTrips('bob'))['same-trip'].title).toBe('bob')
  })
})
