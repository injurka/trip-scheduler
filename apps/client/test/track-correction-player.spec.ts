import type { UseDayTrackMapOptions } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'
import type { DayData, DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory, matchedRouteKey } from 'vue-router'
import { useDialogHistory, waitForDialogHistory } from '../src/renderer/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'
import Player from '../src/renderer/components/04.features/day-track-player/ui/day-track-player.vue'

const api = vi.hoisted(() => ({
  getDay: vi.fn(),
  getTripDay: vi.fn(),
  getTripDaySummary: vi.fn(),
  correctActivities: vi.fn(),
  analyzeQualityIssue: vi.fn(),
  closePopup: vi.fn(),
  mapOptions: null as unknown as UseDayTrackMapOptions,
}))
vi.mock('../src/renderer/components/04.features/day-track-player/lib/track-preview-client', async () => {
  const { createTrackPreviewTask } = await import('../src/renderer/components/04.features/day-track-player/lib/track-preview-task')

  return {
    createTrackPreviewProcessor: () => {
      const task = createTrackPreviewTask()

      return {
        process: async (base: DayData, corrections: NonNullable<DayData['corrections']>) => {
          task.initialize(base)

          return task.calculate(corrections)
        },
        cancel: () => {},
      }
    },
  }
})
vi.mock('~/shared/services/database/tracking.service', () => ({ trackingService: api }))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({ deleteStoredPoint: vi.fn() }))
vi.mock('~/shared/store/auth.store', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))
vi.mock('~/components/01.kit/kit-image-viewer', () => ({ KitImageViewer: { render: () => null }, useImageViewer: () => ({ isOpen: ref(false), images: ref([]), currentIndex: ref(0) }) }))
vi.mock('../src/renderer/components/04.features/day-track-player/composables/use-day-track-map', () => ({
  useDayTrackMap: (options: UseDayTrackMapOptions) => {
    api.mapOptions = options

    return {
      selectedPoint: ref(null),
      isCopied: ref(false),
      centerCurrentPoint: vi.fn(),
      closePointPopup: api.closePopup,
      closePhotoPopup: vi.fn(),
    }
  },
}))
vi.mock('../src/renderer/components/04.features/day-track-player/composables/use-day-track-photos', () => ({
  useDayTrackPhotos: () => ({
    isPhotosVisible: ref(true),
    locatedPhotos: ref([]),
    unlocatedPhotos: ref([]),
    totalPhotosCount: ref(0),
    timelinePhotoMarkers: ref([]),
    selectedPhoto: ref(null),
    selectedClusterPhotos: ref([]),
    selectPhoto: vi.fn(),
    selectCluster: vi.fn(),
    closePhotoPopup: vi.fn(),
  }),
}))
vi.mock('../src/renderer/components/04.features/day-track-player/composables/use-day-track-timezone', () => ({
  useDayTrackTimezone: () => ({
    timeLabel: ref('10:00'),
    timezoneMode: ref('track'),
    deviceTimezone: 'UTC',
    trackTimezone: ref('UTC'),
    fmtRange: () => '10:00',
    formatPointTime: () => '10:00',
  }),
}))

const start = Date.parse('2026-11-12T10:00:00Z')
const points: DayPoint[] = Array.from({ length: 100 }, (_, i) => ({
  clientPointId: `p-${i}`,
  sessionId: 'test-session',
  tsUtc: start + i * 5000,
  lat: 0,
  lng: 30 + i * 7 / 111195,
  accuracy: 5,
  speed: 1.4,
  activity: 'walk',
}))
const data: DayData = { points, segments: [], corrections: [] }
const choice = { sessionId: 'test-session', startedAt: start, endedAt: start + 400000, activity: 'vehicle' }
async function setup(history = createMemoryHistory(), props: Partial<InstanceType<typeof Player>['$props']> = {}) {
  const router = createRouter({ history, routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(Player, {
    props: { dayUtc: '2026-11-12', mode: 'memories', ...props },
    global: {
      provide: { [matchedRouteKey as symbol]: computed(() => router.currentRoute.value.matched[0]) },
      plugins: [router],
      stubs: {
        DayTrackTopNav: defineComponent({ setup: (_, { slots }) => () => h('nav', slots['map-controls']?.()) }),
        DayTrackBeacon: true,
        DayTrackPointPopup: true,
        DayTrackPhotoPopup: true,
        DayTrackOverlayState: defineComponent({ name: 'DayTrackOverlayState', props: ['isLoading', 'summary', 'summaryTimeZone'], render: () => null }),
        DayTrackEmpty: true,
        KitDialogWithClose: defineComponent({ props: { visible: Boolean }, setup: (props, { slots }) => () => props.visible ? h('div', slots.default?.()) : null }),
        DayTrackActivityEditor: defineComponent({ name: 'Editor', props: ['visible', 'stageCorrection', 'removeCorrection'], emits: ['update:visible'], render: () => null }),
        DayTrackPlaybackPanel: defineComponent({ name: 'DayTrackPlaybackPanel', props: { t: Number, speedMultiplier: Number }, setup: (_, { slots }) => () => h('div', { 'data-testid': 'playback-panel' }, [slots.quality?.({ close: () => {} }), slots['draft-actions']?.()]) }),
        KitBtn: defineComponent({ setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }),
      },
    },
  })
  await flushPromises()

  return wrapper
}
function button(wrapper: Awaited<ReturnType<typeof setup>>, text: string) {
  return wrapper.findAll('button').find(b => b.text() === text)!
}
beforeEach(() => {
  api.closePopup.mockReset()
  api.getDay.mockReset().mockImplementation(async () => structuredClone(data))
  api.correctActivities.mockReset().mockResolvedValue({ success: true })
  api.analyzeQualityIssue.mockReset()
  api.getTripDay.mockReset()
  api.getTripDaySummary.mockReset()
})
describe('day summary while loading the route', () => {
  const summary = {
    dayUtc: '2026-11-12',
    totalDistanceM: 6000,
    totalDurationMs: 600_000,
    byActivity: [{ activity: 'rail' as const, distanceM: 6000, durationMs: 600_000, segmentCount: 1 }],
    firstPointTs: start,
    lastPointTs: start + 600_000,
    hasData: true,
  }

  it('reuses the activity summary immediately', async () => {
    const pendingDay = Promise.withResolvers<DayData>()
    api.getDay.mockReturnValueOnce(pendingDay.promise)
    const wrapper = await setup(undefined, { daySummaries: [summary], timeZone: 'UTC' })
    const overlay = wrapper.getComponent({ name: 'DayTrackOverlayState' })

    expect(overlay.props('isLoading')).toBe(true)
    expect(overlay.props('summary')).toEqual(summary)
    expect(wrapper.find('[aria-label="Слежение за текущей точкой"]').exists()).toBe(false)
    expect(api.getTripDaySummary).not.toHaveBeenCalled()
    pendingDay.resolve(structuredClone(data))
    await flushPromises()
    expect(overlay.props('isLoading')).toBe(false)
    expect(wrapper.find('[aria-label="Слежение за текущей точкой"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays the trip summary without waiting for the full track', async () => {
    const pendingDay = Promise.withResolvers<DayData>()
    api.getTripDay.mockReturnValueOnce(pendingDay.promise)
    api.getTripDaySummary.mockResolvedValueOnce({ summary, timeZone: 'Asia/Taipei' })
    const wrapper = await setup(undefined, { tripId: 'test-trip' })
    const overlay = wrapper.getComponent({ name: 'DayTrackOverlayState' })

    expect(overlay.props('isLoading')).toBe(true)
    expect(overlay.props('summary')).toEqual(summary)
    expect(overlay.props('summaryTimeZone')).toBe('Asia/Taipei')
    expect(api.getTripDaySummary).toHaveBeenCalledWith('test-trip', summary.dayUtc, undefined)
    pendingDay.resolve(structuredClone(data))
    await flushPromises()
    expect(overlay.props('isLoading')).toBe(false)
    wrapper.unmount()
  })
})

describe('batch correction player', () => {
  it('stages an AI GPS fix for map comparison and only saves after confirmation', async () => {
    const gpsPoints = points.map((point, index) => index === 10
      ? { ...point, lng: point.lng + 0.0015, accuracy: 60 }
      : point)

    api.getDay.mockImplementation(async () => structuredClone({ ...data, points: gpsPoints }))
    api.analyzeQualityIssue.mockResolvedValue({ action: 'exclude-spike', reason: 'Одиночный скачок.', affectedFixes: 1 })
    const wrapper = await setup()

    try {
      await wrapper.findAll('button').find(b => b.text().startsWith('Проверить участки'))!.trigger('click')
      const quality = wrapper.findAllComponents({ name: 'DayTrackQuality' }).find(view => !view.props('summaryOnly'))!
      const issue = quality.props('quality').issues[0]

      await quality.props('analyze')(issue)
      expect(api.analyzeQualityIssue).toHaveBeenCalledWith(expect.objectContaining({
        dayUtc: '2026-11-12',
        sessionId: issue.sessionId,
        startedAt: issue.startedAt,
        endedAt: issue.endedAt,
      }))
      await quality.props('preview')(issue, 'exclude-spike')
      await flushPromises()
      expect(api.correctActivities).not.toHaveBeenCalled()
      expect(api.mapOptions.dayData.value?.corrections).toEqual([expect.objectContaining({ geometryAction: 'exclude-spike' })])
      expect(api.mapOptions.dayData.value?.rawPoints?.[10].lng).toBe(gpsPoints[10].lng)
      await button(wrapper, 'До').trigger('click')
      expect(api.mapOptions.dayData.value?.corrections).toEqual([])
      expect(button(wrapper, 'После').exists()).toBe(true)
      await button(wrapper, 'После').trigger('click')
      await button(wrapper, 'Применить').trigger('click')
      await flushPromises()
      expect(api.correctActivities).toHaveBeenCalledWith(expect.objectContaining({
        additions: [expect.objectContaining({
          geometryAction: 'exclude-spike',
          startedAt: issue.startedAt,
          endedAt: issue.endedAt,
        })],
      }))
    }
    finally {
      wrapper.unmount()
    }
  })

  it('opens the quality review independently and stages all day proposals before saving', async () => {
    const gpsPoints = points.map((point, index) => index === 10 || index === 25
      ? { ...point, lng: point.lng + 0.0015, accuracy: 60 }
      : point)
    api.getDay.mockImplementation(async () => structuredClone({ ...data, points: gpsPoints }))
    const wrapper = await setup()

    try {
      await wrapper.findAll('button').find(b => b.text().startsWith('Проверить участки'))!.trigger('click')
      expect(wrapper.findAllComponents({ name: 'DayTrackQuality' })).toHaveLength(2)
      await wrapper.findAll('button').find(b => b.text().includes('Предпросмотр правок'))!.trigger('click')
      await flushPromises()
      expect(wrapper.findAllComponents({ name: 'DayTrackQuality' })).toHaveLength(1)
      expect(api.correctActivities).not.toHaveBeenCalled()
      expect(api.mapOptions.dayData.value?.corrections).toHaveLength(2)
      expect(api.mapOptions.dayData.value?.rawPoints).toHaveLength(gpsPoints.length)
      await button(wrapper, 'Применить').trigger('click')
      await flushPromises()
      expect(api.correctActivities).toHaveBeenCalledWith(expect.objectContaining({
        additions: [expect.objectContaining({ geometryAction: 'exclude-spike' }), expect.objectContaining({ geometryAction: 'exclude-spike' })],
      }))
    }
    finally {
      wrapper.unmount()
    }
  })

  it('previews a recording gap separately from the recorded route', async () => {
    const last = points.at(-1)!
    const after = { ...last, tsUtc: last.tsUtc + 100_000, lng: last.lng + 0.002, clientPointId: 'after-gap' }
    api.getDay.mockImplementation(async () => structuredClone({ ...data, points: [...points, after] }))
    const wrapper = await setup()

    try {
      await wrapper.findAll('button').find(b => b.text().startsWith('Журнал'))!.trigger('click')
      await wrapper.get('.quality-issue-link').trigger('click')
      expect(api.mapOptions.gapConnection?.value).toEqual([[last.lng, last.lat], [after.lng, after.lat]])
      expect(wrapper.text()).toContain('путь между замерами неизвестен')
      expect(api.correctActivities).not.toHaveBeenCalled()
    }
    finally {
      wrapper.unmount()
    }
  })

  it('refreshes silently and defers queue results while the correction editor is open', async () => {
    const wrapper = await setup()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    try {
      const update = Promise.withResolvers<DayData>()
      api.getDay.mockReturnValueOnce(update.promise)
      window.dispatchEvent(new Event('tracking-queue-changed'))
      await vi.advanceTimersByTimeAsync(5000)
      expect(api.getDay).toHaveBeenCalledTimes(2)
      expect(wrapper.findComponent({ name: 'DayTrackOverlayState' }).props('isLoading')).toBe(false)

      const editor = wrapper.findComponent({ name: 'Editor' })
      editor.vm.$emit('update:visible', true)
      await nextTick()
      update.resolve({ points: [], segments: [] })
      await flushPromises()
      window.dispatchEvent(new Event('tracking-queue-changed'))
      await vi.advanceTimersByTimeAsync(10000)
      expect(api.getDay).toHaveBeenCalledTimes(2)

      await editor.props('stageCorrection')(choice)
      editor.vm.$emit('update:visible', false)
      await nextTick()
      await vi.advanceTimersByTimeAsync(5000)
      expect(api.getDay).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).toContain('Правок: 1')

      await button(wrapper, 'Отменить').trigger('click')
      await vi.advanceTimersByTimeAsync(5000)
      expect(api.getDay).toHaveBeenCalledTimes(3)
    }
    finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('hides and restores the player without losing position, speed or correction drafts', async () => {
    const wrapper = await setup()
    const panel = wrapper.findComponent({ name: 'DayTrackPlaybackPanel' })
    panel.vm.$emit('update:t', start + 100000)
    panel.vm.$emit('update:speedMultiplier', 4)
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    await flushPromises()
    const before = { ...panel.props() }
    expect(before.t).toBe(start + 100000)
    expect(before.speedMultiplier).toBe(4)
    await wrapper.get('[aria-label="Скрыть плеер"]').trigger('click')
    expect(wrapper.find('[data-testid="playback-panel"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Показать плеер"]').attributes('aria-pressed')).toBe('false')
    await wrapper.get('[aria-label="Показать плеер"]').trigger('click')
    const restored = wrapper.findComponent({ name: 'DayTrackPlaybackPanel' })
    expect(restored.props('t')).toBe(before.t)
    expect(restored.props('speedMultiplier')).toBe(before.speedMultiplier)
    expect(wrapper.text()).toContain('Правок: 1')
    expect(api.correctActivities).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stages several edits without requests and applies with one mutation and one day reload', async () => {
    const wrapper = await setup()
    const editor = wrapper.findComponent({ name: 'Editor' })
    await editor.props('stageCorrection')(choice)
    await editor.props('stageCorrection')({ ...choice, startedAt: start + 100000, endedAt: start + 200000, activity: 'bike' })
    await flushPromises()
    expect(wrapper.text()).toContain('Правок: 2')
    expect(api.closePopup).toHaveBeenCalledTimes(2)
    expect(api.correctActivities).not.toHaveBeenCalled()
    expect(api.getDay).toHaveBeenCalledTimes(1)
    api.mapOptions.t.value = start + 170000
    const reload = Promise.withResolvers<DayData>()
    api.getDay.mockReturnValueOnce(reload.promise)
    await button(wrapper, 'Применить').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'DayTrackOverlayState' }).props('isLoading')).toBe(true)
    expect(wrapper.find('[data-testid="playback-panel"]').exists()).toBe(false)
    reload.resolve(structuredClone(data))
    await flushPromises()
    expect(api.correctActivities).toHaveBeenCalledTimes(1)
    expect(api.correctActivities.mock.calls[0][0].additions).toHaveLength(2)
    expect(api.getDay).toHaveBeenCalledTimes(2)
    expect(api.closePopup).toHaveBeenCalledTimes(3)
    expect(api.mapOptions.t.value).toBe(start + 170000)
    expect(wrapper.find('.draft-toolbar').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playback-panel"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('retains edits after a failed save and retries the same IDs', async () => {
    const wrapper = await setup()
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    api.correctActivities.mockRejectedValueOnce(new Error('Нет сети'))
    await flushPromises()
    await button(wrapper, 'Применить').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('Нет сети')
    expect(api.getDay).toHaveBeenCalledTimes(1)
    const id = api.correctActivities.mock.calls[0][0].additions[0].id
    await button(wrapper, 'Применить').trigger('click')
    await flushPromises()
    expect(api.correctActivities.mock.calls[1][0].additions[0].id).toBe(id)
    wrapper.unmount()
  })
  it('retries only the reload when saving succeeded but reading failed', async () => {
    const wrapper = await setup()
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    api.getDay.mockRejectedValueOnce(new Error('Нет сети'))
    await flushPromises()
    await button(wrapper, 'Применить').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Правки сохранены')
    await button(wrapper, 'Загрузить').trigger('click')
    await flushPromises()
    expect(api.correctActivities).toHaveBeenCalledTimes(1)
    expect(api.getDay).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })
  it('guards exit and allows staying or discarding without requests', async () => {
    const wrapper = await setup()
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    await flushPromises()
    const leaving = (wrapper.vm as unknown as { requestLeave: () => Promise<boolean> }).requestLeave()
    await flushPromises()
    document.body.querySelectorAll('button').forEach((b) => {
      if (b.textContent?.trim() === 'Остаться')
        b.click()
    })
    expect(await leaving).toBe(false)
    const discard = (wrapper.vm as unknown as { requestLeave: () => Promise<boolean> }).requestLeave()
    await flushPromises()
    document.body.querySelectorAll('button').forEach((b) => {
      if (b.textContent?.trim() === 'Сбросить и продолжить')
        b.click()
    })
    expect(await discard).toBe(true)
    expect(api.correctActivities).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('applies the packet before allowing navigation', async () => {
    const wrapper = await setup()
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    await flushPromises()
    const leaving = (wrapper.vm as unknown as { requestLeave: () => Promise<boolean> }).requestLeave()
    await flushPromises()
    document.body.querySelectorAll('button').forEach((b) => {
      if (b.textContent?.trim() === 'Применить и продолжить')
        b.click()
    })
    expect(await leaving).toBe(true)
    expect(api.correctActivities).toHaveBeenCalledTimes(1)
    expect(api.getDay).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
  it.each(['web', 'hash'])('keeps tracking open after staging and Stay with %s history', async (mode) => {
    window.history.replaceState(null, '', '/')
    const history = mode === 'hash' ? createWebHashHistory() : createWebHistory()
    const wrapper = await setup(history)
    const outerOpen = ref(false)
    const parentOpen = ref(false)
    const editorOpen = ref(false)
    const scope = effectScope()
    scope.run(() => {
      useDialogHistory(`outer-${mode}`, outerOpen)
      useDialogHistory(`tracking-${mode}`, parentOpen, { canClose: () => (wrapper.vm as unknown as { requestLeave: () => Promise<boolean> }).requestLeave() })
      useDialogHistory(`editor-${mode}`, editorOpen)
    })
    outerOpen.value = true
    await nextTick()
    parentOpen.value = true
    await nextTick()
    editorOpen.value = true
    await nextTick()
    await wrapper.findComponent({ name: 'Editor' }).props('stageCorrection')(choice)
    editorOpen.value = false
    await waitForDialogHistory()
    await flushPromises()
    expect(parentOpen.value).toBe(true)
    expect(document.querySelector('[role=alertdialog]')).toBeNull()
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushPromises()
    expect(parentOpen.value).toBe(true)
    const stay = [...document.body.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Остаться')
    expect(stay).toBeDefined()
    stay!.click()
    await flushPromises()
    expect(parentOpen.value).toBe(true)
    expect(wrapper.text()).toContain('Правок: 1')
    expect(window.history.state.dialogId).toBe(`tracking-${mode}`)
    await button(wrapper, 'Отменить').trigger('click')
    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 100))
    await waitForDialogHistory()
    expect(parentOpen.value).toBe(false)
    expect(outerOpen.value).toBe(true)
    wrapper.unmount()
    outerOpen.value = false
    await waitForDialogHistory()
    scope.stop()
    history.destroy()
  })
})
