import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  vi.stubGlobal('navigator', { onLine: true })
})
afterEach(() => vi.unstubAllGlobals())

describe('offline preference', () => {
  it('restores the preference before dispatch', async () => {
    localStorage.setItem('trip-scheduler:forced-offline', 'true')
    const { useConnectivity, onlineFetch } = await import('../src/renderer/shared/lib/connectivity')
    expect(useConnectivity().forcedOffline.value).toBe(true)
    await expect(onlineFetch('https://example.com')).rejects.toThrow('офлайн')
  })

  it('persists changes and synchronizes other tabs', async () => {
    const { setForcedOffline, useConnectivity } = await import('../src/renderer/shared/lib/connectivity')
    setForcedOffline(true)
    expect(localStorage.getItem('trip-scheduler:forced-offline')).toBe('true')
    localStorage.setItem('trip-scheduler:forced-offline', 'false')
    window.dispatchEvent(new StorageEvent('storage', { key: 'trip-scheduler:forced-offline' }))
    expect(useConnectivity().isOnline.value).toBe(true)
  })

  it('does not override physical network loss', async () => {
    const { setForcedOffline, useConnectivity, isAppOnline } = await import('../src/renderer/shared/lib/connectivity')
    setForcedOffline(true)
    vi.stubGlobal('navigator', { onLine: false })
    window.dispatchEvent(new Event('offline'))
    setForcedOffline(false)
    expect(useConnectivity().isOnline.value).toBe(false)
    expect(isAppOnline()).toBe(false)
    vi.stubGlobal('navigator', { onLine: true })
    window.dispatchEvent(new Event('online'))
    expect(useConnectivity().isOnline.value).toBe(true)
  })
})
