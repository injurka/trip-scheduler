import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('~/shared/lib/env', () => ({ isMobileApp: true }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, addPluginListener: vi.fn() }))
const { geotrack } = await import('../src/renderer/shared/services/tracking/geotrack-client')
const ownerId = '11111111-1111-4111-8111-111111111111'
const positions = [{
  ownerId,
  sessionId: 'native-session',
  clientPointId: 'native-point-0001',
  timestamp: Date.now(),
  latitude: 55,
  longitude: 48,
  accuracy: 5,
  speed: 1,
}]
beforeEach(() => {
  vi.restoreAllMocks()
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => storage.clear(),
  })
  localStorage.setItem('auth_user', JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }))
  mocks.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === 'tracking_is_running')
      return false

    if (command === 'tracking_check_permissions')
      return { batteryOptimizationsIgnored: true, ownerId }

    if (command === 'tracking_get_buffered')
      return positions

    return true
  })
})
it('copies native points before acknowledging and preserves IDs across repeated reads', async () => {
  const first = await geotrack.getUnsent()
  const second = await geotrack.getUnsent()
  expect(first).toHaveLength(1)
  expect(second).toHaveLength(1)
  expect(first[0]?.clientPointId).toBe(second[0]?.clientPointId)
  expect(mocks.invoke).toHaveBeenCalledWith('tracking_ack_buffered', { clientPointIds: [positions[0]!.clientPointId], ownerId })
})
it('never acknowledges native storage if browser persistence fails', async () => {
  vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
    throw new Error('QuotaExceededError')
  })
  await expect(geotrack.getUnsent()).rejects.toThrow('QuotaExceededError')
  expect(mocks.invoke.mock.calls.some(([command]) => command === 'tracking_ack_buffered')).toBe(false)
})
it('does not restart a service stopped from the notification while WebView was closed', async () => {
  localStorage.setItem(`tripscheduler_tracking_session:v2:${ownerId}`, JSON.stringify({
    sessionId: 'saved-session',
    startedAt: Date.now(),
    distanceM: 0,
    lastPoint: null,
    isRunning: true,
  }))
  vi.resetModules()
  const restored = (await import('../src/renderer/shared/services/tracking/geotrack-client')).geotrack
  await vi.waitFor(async () => {
    const status = await restored.status()
    expect(status.transitioning).toBe(false)
    expect(status.running).toBe(false)
  })
  expect(mocks.invoke.mock.calls.some(([command]) => command === 'tracking_start')).toBe(false)
})

it('surfaces native disk failures instead of claiming that the latest fix was saved', async () => {
  const originalInvoke = mocks.invoke.getMockImplementation()!
  mocks.invoke.mockImplementation(async (command: string, args: unknown) => command === 'tracking_check_permissions'
    ? {
        ownerId,
        batteryOptimizationsIgnored: true,
        storageError: 'disk full',
        pendingWrites: 1,
        lastSavedTsUtc: null,
      }
    : originalInvoke(command, args))
  const status = await geotrack.status()
  expect(status.storageError).toBe('disk full')
  expect(status.error).toBe('disk full')
  expect(status.pendingWrites).toBe(1)
  expect(status.lastSavedTsUtc).toBeNull()
})

it('shows a notice for preserved unowned native records', async () => {
  const originalInvoke = mocks.invoke.getMockImplementation()!
  mocks.invoke.mockImplementation(async (command: string, args: unknown) => command === 'tracking_check_permissions'
    ? { ownerId, batteryOptimizationsIgnored: true, legacyQueuePreserved: true }
    : originalInvoke(command, args))
  expect((await geotrack.status()).legacyQueuePreserved).toBe(true)
})

it('filters out native local points with accuracy worse than MAX_ACCURACY_M', async () => {
  const originalInvoke = mocks.invoke.getMockImplementation()!
  mocks.invoke.mockImplementation(async (command: string, args: unknown) => command === 'tracking_get_local_points'
    ? [
        ...positions,
        { ...positions[0]!, clientPointId: 'native-noisy-175', accuracy: 175 },
      ]
    : originalInvoke(command, args))
  const local = await geotrack.localPoints(0, Date.now() + 10_000)
  expect(local.map(p => p.clientPointId)).toEqual(['native-point-0001'])
})
