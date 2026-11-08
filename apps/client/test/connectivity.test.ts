import { afterEach, describe, expect, it } from 'bun:test'
import { isAppOnline, onlineFetch, setForcedOffline, useConnectivity } from '../src/renderer/shared/lib/connectivity'

afterEach(() => setForcedOffline(false))

describe('forced offline mode', () => {
  it('updates the shared reactive state without changing browser connectivity', () => {
    const { forcedOffline, isOnline } = useConnectivity()
    setForcedOffline(true)
    expect(forcedOffline.value).toBe(true)
    expect(isOnline.value).toBe(false)
    expect(isAppOnline()).toBe(false)
    setForcedOffline(false)
    expect(forcedOffline.value).toBe(false)
    expect(isAppOnline()).toBe(typeof navigator === 'undefined' || navigator.onLine !== false)
  })

  it('blocks reads and writes before dispatch and allows them after disabling', async () => {
    const originalFetch = globalThis.fetch
    const calls: unknown[] = []
    globalThis.fetch = Object.assign(async (...args: Parameters<typeof fetch>) => {
      calls.push(args)

      return new Response('ok')
    }, { preconnect: originalFetch.preconnect })

    try {
      setForcedOffline(true)
      await expect(onlineFetch('https://example.com/trpc')).rejects.toThrow('офлайн')
      await expect(onlineFetch('https://example.com/upload', { method: 'POST' })).rejects.toThrow('офлайн')
      expect(calls).toHaveLength(0)
      setForcedOffline(false)
      await onlineFetch('https://example.com/trpc')
      expect(calls).toHaveLength(1)
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })
})
