import { describe, expect, it, mock } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'

mock.module('~/plugins/request', () => ({ useRequest: mock(() => {}), useRequestStatus: mock(() => false) }))
const { useOfflineStore } = await import('../src/renderer/shared/store/offline.store')

describe('offline progress dialog store state', () => {
  it('manages dialog visibility and active download id when minimizing and reopening', () => {
    setActivePinia(createPinia())
    const offlineStore = useOfflineStore()

    // Initially progress dialog is not minimized
    expect(offlineStore.isProgressMinimized).toBe(false)
    expect(offlineStore.activeProgressTripId).toBeNull()

    // Simulate download starts for trip-123
    offlineStore.isDownloading['trip-123'] = true
    offlineStore.downloadProgress['trip-123'] = 25
    offlineStore.downloadStatus['trip-123'] = {
      progress: 25,
      total: 10,
      loaded: 2,
      stage: 'caching',
      statusText: 'Загрузка медиа...',
      tripTitle: 'Путешествие в Токио',
    }

    // User minimizes the dialog to background
    offlineStore.minimizeProgressDialog()
    expect(offlineStore.isProgressMinimized).toBe(true)

    // User clicks on "Загрузка..."
    offlineStore.openProgressDialog('trip-123')
    expect(offlineStore.isProgressMinimized).toBe(false)
    expect(offlineStore.activeProgressTripId).toBe('trip-123')

    // Calling openProgressDialog without id picks active download
    offlineStore.minimizeProgressDialog()
    expect(offlineStore.isProgressMinimized).toBe(true)
    offlineStore.openProgressDialog()
    expect(offlineStore.isProgressMinimized).toBe(false)
    expect(offlineStore.activeProgressTripId).toBe('trip-123')
  })
})
