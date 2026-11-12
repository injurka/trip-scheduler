import type { UseDayTrackMapOptions } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'
import type { DayData, DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory, matchedRouteKey } from 'vue-router'
import { useDialogHistory, waitForDialogHistory } from '../src/renderer/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'
import Player from '../src/renderer/components/04.features/day-track-player/ui/day-track-player.vue'

const api = vi.hoisted(() => ({ getDay: vi.fn(), correctActivities: vi.fn(), mapOptions: null as unknown as UseDayTrackMapOptions }))
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
      closePointPopup: vi.fn(),
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
async function setup(history = createMemoryHistory()) {
  const router = createRouter({ history, routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(Player, {
    props: { dayUtc: '2026-11-12', mode: 'memories' },
    global: {
      provide: { [matchedRouteKey as symbol]: computed(() => router.currentRoute.value.matched[0]) },
      plugins: [router],
      stubs: {
        DayTrackTopNav: true,
        DayTrackBeacon: true,
        DayTrackPointPopup: true,
        DayTrackPhotoPopup: true,
        DayTrackOverlayState: true,
        DayTrackEmpty: true,
        DayTrackActivityEditor: defineComponent({ name: 'Editor', props: ['visible'], emits: ['stage', 'remove', 'update:visible'], render: () => null }),
        DayTrackPlaybackPanel: defineComponent({ setup: (_, { slots }) => () => h('div', slots['draft-actions']?.()) }),
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
  api.getDay.mockReset().mockImplementation(async () => structuredClone(data))
  api.correctActivities.mockReset().mockResolvedValue({ success: true })
})
describe('batch correction player', () => {
  it('stages several edits without requests and applies with one mutation and one day reload', async () => {
    const wrapper = await setup()
    const editor = wrapper.findComponent({ name: 'Editor' })
    editor.vm.$emit('stage', choice)
    editor.vm.$emit('stage', { ...choice, startedAt: start + 100000, endedAt: start + 200000, activity: 'bike' })
    await flushPromises()
    expect(wrapper.text()).toContain('Изменений: 2')
    expect(api.correctActivities).not.toHaveBeenCalled()
    expect(api.getDay).toHaveBeenCalledTimes(1)
    api.mapOptions.t.value = start + 170000
    await button(wrapper, 'Применить').trigger('click')
    await flushPromises()
    expect(api.correctActivities).toHaveBeenCalledTimes(1)
    expect(api.correctActivities.mock.calls[0][0].additions).toHaveLength(2)
    expect(api.getDay).toHaveBeenCalledTimes(2)
    expect(api.mapOptions.t.value).toBe(start + 170000)
    expect(wrapper.find('.draft-toolbar').exists()).toBe(false)
    wrapper.unmount()
  })
  it('retains edits after a failed save and retries the same IDs', async () => {
    const wrapper = await setup()
    wrapper.findComponent({ name: 'Editor' }).vm.$emit('stage', choice)
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
    wrapper.findComponent({ name: 'Editor' }).vm.$emit('stage', choice)
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
    wrapper.findComponent({ name: 'Editor' }).vm.$emit('stage', choice)
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
    wrapper.findComponent({ name: 'Editor' }).vm.$emit('stage', choice)
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
    wrapper.findComponent({ name: 'Editor' }).vm.$emit('stage', choice)
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
    expect(wrapper.text()).toContain('Изменений: 1')
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
