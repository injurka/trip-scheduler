import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('~/shared/lib/env', () => ({ isMobileApp: true }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, addPluginListener: vi.fn() }))
const { geotrack } = await import('../src/renderer/shared/services/tracking/geotrack-client')
const positions = [{
  timestamp: Date.now(),
  latitude: 55,
  longitude: 48,
  accuracy: 5,
  speed: 1,
}]
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  mocks.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === 'tracking_is_running')
      return false

    if (command === 'tracking_check_permissions')
      return { batteryOptimizationsIgnored: true }

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
  expect(mocks.invoke).toHaveBeenCalledWith('tracking_ack_buffered', { timestamps: [positions[0]!.timestamp] })
})
it('never acknowledges native storage if browser persistence fails', async () => {
  vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
    throw new Error('QuotaExceededError')
  })
  await expect(geotrack.getUnsent()).rejects.toThrow('QuotaExceededError')
  expect(mocks.invoke.mock.calls.some(([command]) => command === 'tracking_ack_buffered')).toBe(false)
})
it('does not restart a service stopped from the notification while WebView was closed', async () => {
  localStorage.setItem('tripscheduler_tracking_session', JSON.stringify({
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
