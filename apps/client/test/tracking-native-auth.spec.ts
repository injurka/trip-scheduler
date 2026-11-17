import { beforeEach, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ invoke: vi.fn(), grant: vi.fn() }))
vi.mock('~/shared/lib/env', () => ({ isMobileApp: true, SERVER_URL: 'https://gps.example.test' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: m.invoke }))
vi.mock('~/shared/services/database/tracking.service', () => ({ trackingService: { grantNativeSync: m.grant } }))
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('auth_user', JSON.stringify({ id: 'account-A' }))
  m.invoke.mockReset().mockImplementation(async (command: string) => command === 'tracking_check_permissions' ? { ownerId: 'account-A', nativeSyncConfigured: false } : true)
  m.grant.mockReset().mockResolvedValue({ syncToken: 'scoped-device-token', expiresAt: Date.now() + 100000 })
})
it('installs only a device-scoped GPS key and never copies browser login tokens', async () => {
  localStorage.setItem('auth_token', 'browser-private-access')
  localStorage.setItem('auth_refresh_token', 'browser-private-refresh')
  const { ensureNativeTrackingSync } = await import('../src/renderer/shared/services/tracking/native-sync')
  await ensureNativeTrackingSync()
  expect(m.invoke).toHaveBeenCalledWith('tracking_configure', { config: { ownerId: 'account-A', serverUrl: 'https://gps.example.test', syncToken: 'scoped-device-token' } })
  expect(JSON.stringify(m.invoke.mock.calls)).not.toContain('browser-private')
})
it('discards a grant returned after switching accounts and clears native configuration', async () => {
  let resolve!: (value: { syncToken: string }) => void
  m.grant.mockReturnValue(new Promise((r) => {
    resolve = r
  }))
  const { ensureNativeTrackingSync } = await import('../src/renderer/shared/services/tracking/native-sync')
  const configuring = ensureNativeTrackingSync()
  await vi.waitFor(() => expect(m.grant).toHaveBeenCalledOnce())
  localStorage.setItem('auth_user', JSON.stringify({ id: 'account-B' }))
  window.dispatchEvent(new Event('tracking-owner-changed'))
  resolve({ syncToken: 'stale-account-A-key' })
  await configuring
  expect(m.invoke).toHaveBeenCalledWith('tracking_configure', { config: null })
  expect(JSON.stringify(m.invoke.mock.calls)).not.toContain('stale-account-A-key')
})
