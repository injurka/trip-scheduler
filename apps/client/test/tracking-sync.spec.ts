import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUnsent: vi.fn(),
  markSynced: vi.fn(),
  ingest: vi.fn(),
  store: { isSyncing: false, syncError: null as string | null, lastSyncAt: null as number | null, refreshStatus: vi.fn() },
}))
vi.mock('~/shared/store/auth.store', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
vi.mock('~/shared/store/tracking.store', () => ({ useTrackingStore: () => Object.assign(mocks.store, { markSynced: mocks.markSynced }) }))
vi.mock('~/shared/services/trpc/trpc.service', () => ({ trpc: { tracking: { ingestBatch: { mutate: mocks.ingest } } } }))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({ geotrack: { getUnsent: mocks.getUnsent }, parseTrackPoint: (point: unknown) => point }))
const { runSync } = await import('../src/renderer/shared/services/tracking/track-sync')
const points = ['a', 'b'].map(clientPointId => ({
  clientPointId,
  tsUtc: 1,
  lat: 1,
  lng: 2,
  altitude: null,
  accuracy: 5,
  speed: 0,
  bearing: null,
  activity: 'still',
  activityConfidence: 90,
  sessionId: 'session',
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.store.isSyncing = false
  mocks.store.syncError = null
  mocks.getUnsent.mockResolvedValue(points)
  mocks.markSynced.mockResolvedValue(undefined)
  mocks.store.refreshStatus.mockResolvedValue(undefined)
})
it('retains points on a lost response and acknowledges the retry', async () => {
  mocks.ingest.mockRejectedValueOnce(new Error('Failed to fetch'))
  await expect(runSync()).rejects.toThrow()
  expect(mocks.markSynced).not.toHaveBeenCalled()
  expect(mocks.store.syncError).toContain('сохранены')
  mocks.ingest.mockResolvedValueOnce({ accepted: ['a', 'b'], rejectedCount: 0 })
  await expect(runSync()).resolves.toBe(2)
  expect(mocks.markSynced).toHaveBeenCalledWith(['a', 'b'])
  expect(mocks.store.syncError).toBeNull()
})
it('retains rejected points and ignores unrelated acknowledgements', async () => {
  mocks.ingest.mockResolvedValue({ accepted: ['a', 'foreign'], rejectedCount: 1 })
  await expect(runSync()).rejects.toThrow('часть')
  expect(mocks.markSynced).toHaveBeenCalledWith(['a'])
})
it('shares one in-flight upload with concurrent callers', async () => {
  let resolve!: (result: { accepted: string[], rejectedCount: number }) => void
  mocks.ingest.mockReturnValue(new Promise((r) => {
    resolve = r
  }))
  const first = runSync()
  const second = runSync()
  expect(first).toBe(second)
  await vi.waitFor(() => expect(mocks.ingest).toHaveBeenCalledOnce())
  resolve({ accepted: ['a', 'b'], rejectedCount: 0 })
  await expect(first).resolves.toBe(2)
  await expect(second).resolves.toBe(2)
  expect(mocks.store.isSyncing).toBe(false)
})
