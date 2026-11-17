import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, ref } from 'vue'
import { useCalendarDay } from '../src/renderer/shared/composables/use-calendar-day'

const m = vi.hoisted(() => ({
  route: { query: { day: '2026-11-16' }, params: {} },
  getDay: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => m.route,
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('~/shared/services/database/tracking.service', () => ({
  trackingService: { getDay: m.getDay },
}))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({
  deleteStoredPoint: vi.fn(),
}))
vi.mock('~/shared/services/trpc/trpc.service', () => ({
  trpc: {
    tracking: { getSummaries: { query: async () => ({ summaries: [] }) } },
  },
}))
const { useDayTrackData }
  = await import('../src/renderer/components/04.features/day-track-player/composables/use-day-track-data')
const { useActivityTracking }
  = await import('../src/renderer/components/05.modules/activity-tracking/composables/use-activity-tracking')
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-16T15:59:59Z'))
  m.getDay.mockResolvedValue({
    points: [],
    segments: [],
    timeZone: 'Asia/Taipei',
  })
})
afterEach(() => vi.useRealTimers())
it('updates the trip calendar at local midnight without moving the selected day', async () => {
  const scope = effectScope()
  const state = scope.run(() =>
    useDayTrackData({ timeZone: ref('Asia/Taipei') }))!
  expect(state.todayUtc.value).toBe('2026-11-16')
  await vi.advanceTimersByTimeAsync(1100)
  expect(state.todayUtc.value).toBe('2026-11-17')
  expect(state.selectedDay.value).toBe('2026-11-16')
  state.changeDay(1)
  await flushPromises()
  expect(state.selectedDay.value).toBe('2026-11-17')
  state.selectedDay.value = '2026-11-15'
  state.goToToday()
  await flushPromises()
  expect(state.selectedDay.value).toBe('2026-11-17')
  scope.stop()
})
it('refreshes today on resume and removes its clock and listeners when disposed', () => {
  const timeZone = ref('Asia/Taipei')
  const scope = effectScope()
  const today = scope.run(() => useCalendarDay(timeZone))!
  expect(today.value).toBe('2026-11-16')
  vi.setSystemTime(new Date('2026-11-17T16:00:00Z'))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(today.value).toBe('2026-11-18')
  timeZone.value = 'UTC'
  expect(today.value).toBe('2026-11-17')
  vi.setSystemTime(new Date('2026-11-18T16:00:00Z'))
  window.dispatchEvent(new Event('focus'))
  expect(today.value).toBe('2026-11-18')
  scope.stop()
  vi.setSystemTime(new Date('2026-11-20T16:00:00Z'))
  window.dispatchEvent(new Event('focus'))
  expect(today.value).toBe('2026-11-18')
})
it('updates the activity overview today value across midnight', async () => {
  vi.setSystemTime(new Date('2026-11-16T23:59:59Z'))
  let state!: ReturnType<typeof useActivityTracking>
  const wrapper = mount(defineComponent({
    setup() {
      state = useActivityTracking()

      return () => h('div')
    },
  }))
  const before = state.todayUtc.value
  await vi.advanceTimersByTimeAsync(86400000)
  expect(state.todayUtc.value).not.toBe(before)
  expect(state.isToday(state.todayUtc.value)).toBe(true)
  wrapper.unmount()
})
