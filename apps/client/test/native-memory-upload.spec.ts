import type { IProcessingMemory } from '../src/renderer/components/04.features/trip-info/trip-memories/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { runNativeMemoryUploads } from '../src/renderer/components/04.features/trip-info/trip-memories/lib/native-memory-upload'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), load: vi.fn(), save: vi.fn() }))
const forced = ref(false)
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('~/shared/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 'account' }, tokenPair: { accessToken: 'token', refreshToken: 'refresh' }, saveTokens: mocks.save }) }))
vi.mock('~/shared/lib/env', () => ({ SERVER_URL: 'https://server.test' }))
vi.mock('~/shared/lib/connectivity', () => ({ requireAppOnline() {}, useConnectivity: () => ({ forcedOffline: forced }) }))
vi.mock('~/plugins/request/lib/service', () => ({ getDatabaseService: () => ({ memories: { getByTripId: mocks.load } }) }))
function store() {
  const items = ['one', 'two'].map(id => [id, {
    tempId: id,
    file: new File(['photo'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: 'blob:test',
    status: 'queued',
    progress: 0,
  }] as const)

  return { currentTripId: 'trip', memories: [], processingMemories: new Map<string, IProcessingMemory>(items) }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())
describe('native memory uploads', () => {
  it('stages the full batch once, then mirrors native progress and completion', async () => {
    vi.useFakeTimers()
    let polls = 0
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === 'tracking_request_notification_permission')
        return true

      if (args.operation !== 'status')
        return true

      polls++

      return {
        id: 'job',
        tripId: 'trip',
        isRunning: polls === 1,
        items: [
          { id: 'one', status: 'success', progress: 100 },
          { id: 'two', status: polls === 1 ? 'uploading' : 'success', progress: polls === 1 ? 42 : 100 },
        ],
      }
    })
    const state = store()
    const running = runNativeMemoryUploads(state, 'trip', ['2026-11-15'])
    await vi.advanceTimersByTimeAsync(0)
    expect(state.processingMemories.get('two')?.progress).toBe(42)
    await runNativeMemoryUploads(state, 'trip', [])
    expect(mocks.invoke.mock.calls.filter(([, args]) => args?.operation === 'start')).toHaveLength(1)
    expect(mocks.invoke.mock.calls.find(([, args]) => args?.operation === 'start')?.[1].payload.files).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(750)
    await running
    expect(state.processingMemories.size).toBe(0)
    expect(mocks.load).toHaveBeenCalledWith('trip')
  })
  it('does not start without notification permission and leaves files retryable', async () => {
    mocks.invoke.mockResolvedValue(false)
    const state = store()
    await runNativeMemoryUploads(state, 'trip', [])
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect([...state.processingMemories.values()].every(item => item.status === 'error')).toBe(true)
  })
  it('retains the uploaded image after memory finalization fails', async () => {
    mocks.invoke.mockImplementation(async (command, args) => command === 'tracking_request_notification_permission' || args.operation !== 'status'
      ? true
      : {
          id: 'job',
          isRunning: false,
          items: [{ id: 'one', status: 'error', error: 'HTTP 503', image: { id: 'image' } }, { id: 'two', status: 'cancelled' }],
        })
    const state = store()
    await runNativeMemoryUploads(state, 'trip', [])
    expect(state.processingMemories.get('one')).toMatchObject({ status: 'error', uploadedImage: { id: 'image' }, error: 'HTTP 503' })
    expect(state.processingMemories.has('two')).toBe(false)
  })
})
