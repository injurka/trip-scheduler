import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, effectScope, h, ref } from 'vue'

const m = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: { id: 'account-A' } },
  getUnsent: vi.fn(),
  ingest: vi.fn(),
  markSynced: vi.fn(),
  getDay: vi.fn(),
  getLocal: vi.fn(),
  route: { name: 'ActivityMap', query: { day: '2026-11-15' }, params: {} },
  store: { isSyncing: false, syncError: null, lastSyncAt: null, refreshStatus: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('~/shared/store/auth.store', () => ({ useAuthStore: () => m.auth }))
vi.mock('~/shared/store/tracking.store', () => ({ useTrackingStore: () => ({ ...m.store, markSynced: m.markSynced }) }))
vi.mock('~/shared/lib/connectivity', () => ({ isAppOnline: () => true }))
vi.mock('~/shared/services/trpc/trpc.service', () => ({ trpc: { tracking: { ingestBatch: { mutate: m.ingest } } } }))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({ geotrack: { getUnsent: m.getUnsent, markSynced: m.markSynced, localPoints: m.getLocal }, parseTrackPoint: (p: unknown) => p, deleteStoredPoint: vi.fn() }))
vi.mock('~/shared/services/database/tracking.service', () => ({ trackingService: { getDay: m.getDay } }))
vi.mock('vue-router', () => ({ useRoute: () => m.route, useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../src/renderer/components/04.features/day-track-player/lib/track-preview-client', async () => {
  const { createTrackPreviewTask } = await import('../src/renderer/components/04.features/day-track-player/lib/track-preview-task')

  return {
    createTrackPreviewProcessor: () => {
      const task = createTrackPreviewTask()

      return {
        process: async (base: unknown, corrections: unknown) => {
          task.initialize(base as never)

          return task.calculate(corrections as never)
        },
        cancel: vi.fn(),
      }
    },
  }
})
const { runSync } = await import('../src/renderer/shared/services/tracking/track-sync')
const { useDayTrackData } = await import('../src/renderer/components/04.features/day-track-player/composables/use-day-track-data')
const { useDayTrackPlayback } = await import('../src/renderer/components/04.features/day-track-player/composables/use-day-track-playback')
const start = Date.parse('2026-11-15T12:00:00Z')
function point(tsUtc = start, sessionId = 'session-A', lat = 55) {
  return {
    clientPointId: `point-A-${tsUtc}`,
    sessionId,
    tsUtc,
    lat,
    lng: 48,
    accuracy: 5,
    speed: null,
    bearing: null,
    altitude: null,
    activity: 'walk' as const,
    activityConfidence: 90,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  m.getLocal.mockResolvedValue([])
  m.auth.user.id = 'account-A'
  localStorage.setItem('auth_user', JSON.stringify(m.auth.user))
  m.route.query.day = '2026-11-15'
})
describe('tracking regressions', () => {
  it('does not submit account-A queue if account changes during the native read', async () => {
    m.getUnsent.mockImplementation(async () => {
      m.auth.user.id = 'account-B'
      localStorage.setItem('auth_user', JSON.stringify(m.auth.user))

      return [point()]
    })
    let sentAs = ''
    m.ingest.mockImplementation(async () => {
      sentAs = m.auth.user.id

      return { accepted: [point().clientPointId], rejectedCount: 0 }
    })
    await runSync()
    expect(sentAs).toBe('')
    expect(m.ingest).not.toHaveBeenCalled()
    expect(m.markSynced).not.toHaveBeenCalled()
  })
  it('acknowledges only the original owner when an in-flight upload completes after switching', async () => {
    m.getUnsent.mockResolvedValue([point()])
    let resolve!: (value: { accepted: string[], rejectedCount: number }) => void
    m.ingest.mockReturnValue(new Promise((r) => {
      resolve = r
    }))
    const sync = runSync()
    await vi.waitFor(() => expect(m.ingest).toHaveBeenCalledOnce())
    expect(m.ingest.mock.calls[0][0].ownerId).toBe('account-A')
    m.auth.user.id = 'account-B'
    localStorage.setItem('auth_user', JSON.stringify(m.auth.user))
    resolve({ accepted: [point().clientPointId], rejectedCount: 0 })
    await sync
    expect(m.markSynced).toHaveBeenCalledWith([point().clientPointId], 'account-A')
  })
  it('clears previous-day geometry immediately and shows a failed request', async () => {
    m.getDay.mockResolvedValueOnce({ points: [point(), point(start + 10000, 'session-A', 55.0001)], segments: [], corrections: [] })
    const scope = effectScope()
    const state = scope.run(() => useDayTrackData())!
    await flushPromises()
    expect(state.dayData.value?.rawPoints?.length).toBe(2)
    m.getDay.mockRejectedValueOnce(new Error('offline'))
    state.selectedDay.value = '2026-11-16'
    expect(state.dayData.value).toBeNull()
    await flushPromises()
    expect(m.getDay).toHaveBeenLastCalledWith('2026-11-16', expect.any(String))
    expect(state.selectedDay.value).toBe('2026-11-16')
    expect(state.dayData.value).toBeNull()
    expect(state.loadError.value).toBe('offline')
    scope.stop()
  })
  it('does not calculate speed across a session break', () => {
    let playback!: ReturnType<typeof useDayTrackPlayback>
    const data = { points: [point(), point(start + 1000, 'session-B', 55.01)], segments: [] }
    const wrapper = mount(defineComponent({
      setup() {
        playback = useDayTrackPlayback({
          selectedDay: ref('2026-11-15'),
          dayStart: computed(() => start),
          dayEnd: computed(() => start + 1000),
          dayData: ref(data),
          renderSegments: computed(() => []),
        })

        return () => h('div')
      },
    }))
    playback.t.value = start + 1000
    expect(playback.currentPoint.value?.activity).toBe('walk')
    expect(playback.speedKmhFromPoints.value).toBeNull()
    wrapper.unmount()
  })
  it('preserves a manual correction at the final measured fix while leaving real gaps unknown', () => {
    let playback!: ReturnType<typeof useDayTrackPlayback>
    const final = { ...point(start + 10000), activity: 'rail' as const, activitySource: 'manual' as const }
    const data = { points: [point(), final], segments: [] }
    const wrapper = mount(defineComponent({
      setup() {
        playback = useDayTrackPlayback({
          selectedDay: ref('2026-11-15'),
          dayStart: computed(() => start),
          dayEnd: computed(() => start + 10000),
          dayData: ref(data),
          renderSegments: computed(() => []),
        })

        return () => h('div')
      },
    }))
    playback.t.value = final.tsUtc
    expect(playback.currentPoint.value).toMatchObject({ activity: 'rail', activitySource: 'manual' })
    playback.t.value = final.tsUtc + 1
    expect(playback.currentPoint.value).toMatchObject({ activity: 'unknown', activitySource: 'automatic', activityConfidence: 0 })
    wrapper.unmount()
  })
  it('merges local pending fixes by ID without duplicating points already on the server', async () => {
    m.getDay.mockResolvedValue({
      ownerId: 'account-A',
      timeZone: 'UTC',
      points: [point()],
      segments: [],
      corrections: [],
    })
    m.getLocal.mockResolvedValue([{ ...point(), localPending: true }, { ...point(start + 10000), localPending: true }])
    const scope = effectScope()
    const state = scope.run(() => useDayTrackData())!
    await flushPromises()
    expect(state.dayData.value?.rawPoints).toHaveLength(2)
    expect(state.dayData.value?.localPendingCount).toBe(1)
    expect(state.dayData.value?.rawPoints?.find(p => p.tsUtc === start)?.localPending).not.toBe(true)
    expect(state.dayData.value?.rawPoints?.find(p => p.tsUtc === start + 10000)?.localPending).toBe(true)
    scope.stop()
  })
  it('filters out fixes exceeding MAX_ACCURACY_M (65m) from both points and rawPoints', async () => {
    m.getDay.mockResolvedValue({
      ownerId: 'account-A',
      timeZone: 'UTC',
      points: [
        point(),
        { ...point(start + 5000, 'session-A', 55.0015), accuracy: 175 },
        point(start + 10000, 'session-A', 55.0001),
      ],
      segments: [],
      corrections: [],
    })
    const scope = effectScope()
    const state = scope.run(() => useDayTrackData())!
    await flushPromises()
    expect(state.dayData.value?.rawPoints?.map(p => p.accuracy)).toEqual([5, 5])
    expect(state.dayData.value?.points.map(p => p.accuracy)).toEqual([5, 5])
    scope.stop()
  })
  it('shows durable local points offline and refuses local data for an unknown trip owner', async () => {
    m.getDay.mockRejectedValue(new Error('offline'))
    m.getLocal.mockResolvedValue([{ ...point(), localPending: true }])
    const scope = effectScope()
    const state = scope.run(() => useDayTrackData())!
    await flushPromises()
    expect(state.dayData.value?.rawPoints).toHaveLength(1)
    expect(state.dayData.value?.localError).toContain('только сохранённые')
    scope.stop()
    m.getLocal.mockClear()
    const tripScope = effectScope()
    const tripState = tripScope.run(() => useDayTrackData({ tripId: ref('unknown-trip') }))!
    await flushPromises()
    expect(tripState.dayData.value).toBeNull()
    expect(m.getLocal).not.toHaveBeenCalled()
    tripScope.stop()
  })
  it('discards local results if the account changes during the read', async () => {
    m.getDay.mockResolvedValue({ points: [], segments: [], corrections: [] })
    m.getLocal.mockImplementation(async () => {
      localStorage.setItem('auth_user', JSON.stringify({ id: 'account-B' }))

      return [{ ...point(), localPending: true }]
    })
    const scope = effectScope()
    const state = scope.run(() => useDayTrackData())!
    await flushPromises()
    expect(state.dayData.value).toBeNull()
    scope.stop()
  })
  it('defers automatic queue refresh while correction drafts are pending', async () => {
    vi.useFakeTimers()
    const allowed = ref(false)
    const scope = effectScope()
    m.getDay.mockResolvedValue({ points: [point()], segments: [], corrections: [] })

    try {
      scope.run(() => useDayTrackData({ canRefresh: () => allowed.value }))
      await flushPromises()
      expect(m.getDay).toHaveBeenCalledOnce()
      window.dispatchEvent(new Event('tracking-queue-changed'))
      await vi.advanceTimersByTimeAsync(10000)
      expect(m.getDay).toHaveBeenCalledOnce()
      allowed.value = true
      await flushPromises()
      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()
      expect(m.getDay).toHaveBeenCalledTimes(2)
    }
    finally {
      scope.stop()
      vi.useRealTimers()
    }
  })
})
