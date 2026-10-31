import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createOAuthClientState, verifyOAuthClientState } from '../src/renderer/shared/lib/oauth-state'

let incoming: (urls: string[]) => Promise<void>
let currentUrls: string[] = []
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
})

const auth = { saveTokens: mock(() => {}), me: mock(async () => {}), user: { id: 'user' } }
const toast = { success: mock(() => {}), error: mock(() => {}) }
const push = mock(async (_route: unknown) => {})
const router = { push, isReady: async () => {} } as unknown as Router
const pinia = {} as Pinia

mock.module('@tauri-apps/plugin-deep-link', () => ({
  getCurrent: async () => currentUrls,
  onOpenUrl: async (handler: typeof incoming) => { incoming = handler },
}))
mock.module('../src/renderer/shared/lib/env', () => ({ isTauri: true, getAppBaseUrl: () => 'https://example.com' }))
mock.module('../src/renderer/shared/store/auth.store', () => ({ useAuthStore: () => auth }))
mock.module('../src/renderer/shared/store/toast.store', () => ({ useToastStore: () => toast }))

const { initializeDeepLinks } = await import('../src/renderer/shared/lib/deep-link')

beforeEach(() => {
  storage.clear()
  currentUrls = []
  auth.saveTokens.mockClear()
  auth.me.mockClear()
  toast.success.mockClear()
  toast.error.mockClear()
  push.mockClear()
})

function callbackUrl(): string {
  return `trip-scheduler://auth/callback?token=test-access&refreshToken=test-refresh&oauth_state=${createOAuthClientState()}`
}

describe('native OAuth callbacks', () => {
  test('waits for session restoration and processes duplicate startup/event delivery once', async () => {
    const url = callbackUrl()
    currentUrls = [url]
    let finishRestoration!: () => void
    const sessionReady = new Promise<void>((resolve) => {
      finishRestoration = resolve
    })
    initializeDeepLinks(pinia, router, sessionReady)
    await Promise.resolve()
    const event = incoming([url])
    await Promise.resolve()
    expect(auth.saveTokens).not.toHaveBeenCalled()

    finishRestoration()
    await event
    expect(auth.saveTokens).toHaveBeenCalledTimes(1)
    expect(auth.me).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/trips')
  })

  test('does not suppress repeated ordinary navigation links', async () => {
    initializeDeepLinks(pinia, router)
    await incoming(['trip-scheduler://trip/example'])
    await incoming(['trip-scheduler://trip/example'])
    expect(push).toHaveBeenCalledTimes(2)
  })

  test('ignores a repeated OAuth event after consuming its nonce', async () => {
    const url = callbackUrl()
    initializeDeepLinks(pinia, router)
    await incoming([url])
    await incoming([url])
    expect(auth.saveTokens).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
  })

  test('a stale callback does not consume the pending nonce of a new login', () => {
    const state = createOAuthClientState()
    expect(verifyOAuthClientState('stale-callback')).toBe(false)
    expect(verifyOAuthClientState(state)).toBe(true)
    expect(verifyOAuthClientState(state)).toBe(false)
  })
})
