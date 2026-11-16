import { afterEach, expect, it, mock } from 'bun:test'
import { ref } from 'vue'

const auth = { user: { id: 'owner' }, tokenPair: { accessToken: 'token', refreshToken: 'refresh' }, saveTokens: () => {} }
const forcedOffline = ref(false)
let handler: (command: string, args?: { operation: string }) => unknown
mock.module('@tauri-apps/api/core', () => ({ invoke: async (command: string, args?: { operation: string }) => handler(command, args) }))
mock.module('~/plugins/request/lib/service', () => ({ getDatabaseService: () => ({ memories: { getByTripId: async () => [] } }) }))
mock.module('~/shared/lib/connectivity', () => ({ requireAppOnline: () => {}, useConnectivity: () => ({ forcedOffline }) }))
mock.module('~/shared/lib/env', () => ({ SERVER_URL: 'https://test.example' }))
mock.module('~/shared/store/auth.store', () => ({ useAuthStore: () => auth }))
const { runNativeMemoryUploads } = await import('../src/renderer/components/04.features/trip-info/trip-memories/lib/native-memory-upload')

function fixture(size = 1) {
  const file = new File([new Uint8Array(size)], 'photo.jpg', { type: 'image/jpeg' })
  const item = {
    tempId: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'queued' as 'queued' | 'error' | 'uploading' | 'success',
    progress: 0,
  }

  return { item, store: { currentTripId: 'trip', processingMemories: new Map([[item.tempId, item]]), memories: [] } }
}
afterEach(() => {
  auth.user.id = 'owner'
})

it('waits for native service shutdown after success before returning', async () => {
  const { item, store } = fixture()
  let reads = 0
  handler = (command, args) => {
    if (command !== 'memory_upload')
      return true

    if (args!.operation === 'status') {
      reads++

      return {
        id: 'job',
        tripId: 'trip',
        accountId: 'owner',
        isRunning: false,
        ready: reads > 1,
        items: [{ id: item.tempId, status: 'success' }],
      }
    }

    return true
  }
  await runNativeMemoryUploads(store, 'trip', ['2026-11-16'])
  expect(reads).toBe(2)
  expect(store.processingMemories.size).toBe(0)
})
it('does not launch an empty file batch and cleans its staged cache', async () => {
  const { item, store } = fixture(0)
  const operations: string[] = []
  handler = (command, args) => {
    if (command === 'memory_upload')
      operations.push(args!.operation)

    return true
  }
  await runNativeMemoryUploads(store, 'trip', ['2026-11-16'])
  expect(operations).toEqual(['cancel'])
  expect(store.processingMemories.get(item.tempId)?.status).toBe('error')
})
it('does not start upload if account changed during staging', async () => {
  const { store } = fixture()
  const operations: string[] = []
  handler = (command, args) => {
    if (command === 'memory_upload') {
      operations.push(args!.operation)

      if (args!.operation === 'stage')
        auth.user.id = 'different-owner'
    }

    return true
  }
  await runNativeMemoryUploads(store, 'trip', ['2026-11-16'])
  expect(operations).not.toContain('start')
})

it('cleans up cancellation during staging without starting a native job', async () => {
  const { store } = fixture()
  const operations: string[] = []
  handler = (command, args) => {
    if (command === 'memory_upload') {
      operations.push(args!.operation)

      if (args!.operation === 'stage')
        store.processingMemories.clear()
    }

    return true
  }
  await runNativeMemoryUploads(store, 'trip', ['2026-11-16'])
  expect(operations).toEqual(['stage', 'cancel'])
})
