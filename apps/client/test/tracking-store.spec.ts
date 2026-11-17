import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ status: vi.fn(), start: vi.fn(), stop: vi.fn() }))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({
  geotrack: { ...mocks, isAvailable: async () => true },
  GeotrackUnavailableError: class extends Error {},
  parseTrackPoint: vi.fn(),
}))
vi.mock('~/shared/services/tracking/track-sync', () => ({ runSync: vi.fn() }))
vi.mock('~/shared/store/auth.store', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
const { useTrackingStore } = await import('../src/renderer/shared/store/tracking.store')
const status = {
  running: false,
  unsentCount: 3,
  network: 'wifi' as const,
  lastFixTsUtc: null,
  batteryIgnored: true,
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  mocks.status.mockResolvedValue(status)
})
it('keeps the switch off until start is confirmed and applies battery state together', async () => {
  let resolve!: (value: typeof status) => void
  mocks.start.mockReturnValue(new Promise((r) => {
    resolve = r
  }))
  const store = useTrackingStore()
  const toggle = store.toggle(true)
  expect(store.isStarting).toBe(true)
  expect(store.isRunning).toBe(false)
  mocks.status.mockResolvedValue({ ...status, running: true })
  resolve({ ...status, running: true })
  await toggle
  expect(store.isRunning).toBe(true)
  expect(store.batteryIgnored).toBe(true)
  expect(store.isStarting).toBe(false)
})
it('ignores a poll started before a toggle and rejects overlapping toggles', async () => {
  let resolveStatus!: (value: typeof status) => void
  mocks.status.mockReturnValueOnce(new Promise((r) => {
    resolveStatus = r
  }))
  const store = useTrackingStore()
  const refresh = store.refreshStatus()
  await vi.waitFor(() => expect(mocks.status).toHaveBeenCalledOnce())
  let resolveStart!: (value: typeof status) => void
  mocks.start.mockReturnValue(new Promise((r) => {
    resolveStart = r
  }))
  const toggle = store.toggle(true)
  await expect(store.toggle(false)).rejects.toThrow('Дождитесь')
  mocks.status.mockResolvedValue({ ...status, running: true })
  resolveStart({ ...status, running: true })
  await toggle
  resolveStatus(status)
  await refresh
  expect(store.isRunning).toBe(true)
  expect(mocks.stop).not.toHaveBeenCalled()
})
it('reports tracker errors without clearing sync failures on polling', async () => {
  const store = useTrackingStore()
  store.syncError = 'Сервер недоступен'
  mocks.status.mockResolvedValue({ ...status, running: true, error: 'Нет сигнала GPS' })
  await store.refreshStatus()
  expect(store.isRunning).toBe(true)
  expect(store.lastError).toBe('Нет сигнала GPS')
  expect(store.syncError).toBe('Сервер недоступен')
})

it('expires GPS accuracy and speed state without another location callback', () => {
  const store = useTrackingStore()
  store.applyStatus({
    ...status,
    running: true,
    lastFixTsUtc: Date.now() - 31000,
    telemetry: {
      speedKmh: 10,
      accuracyM: 5,
      distanceM: 100,
      durationMs: 31000,
      activity: 'walk',
      lat: 25,
      lng: 121,
    },
  })
  expect(store.hasFreshGps).toBe(false)
  expect(store.accuracyQuality).toBe('unknown')
  expect(store.recordingLabel).toBe('Нет свежего GPS')
  store.applyStatus({ ...status, running: true, lastFixTsUtc: Date.now() })
  expect(store.hasFreshGps).toBe(true)
  expect(store.recordingLabel).toBe('Записывается')
})
it('does not call a failed native write saved or sent', () => {
  const store = useTrackingStore()
  store.lastSyncAt = Date.now()
  store.applyStatus({ ...status, unsentCount: 0, storageError: 'Disk full', pendingWrites: 1 })
  expect(store.storageLabel).toBe('Есть несохранённые точки')
  store.applyStatus({ ...status, unsentCount: 2, lastSavedTsUtc: Date.now() })
  expect(store.storageLabel).toBe('Сохранено на устройстве: 2')
  store.applyStatus({ ...status, unsentCount: 0 })
  expect(store.storageLabel).toBe('Отправлено')
})
