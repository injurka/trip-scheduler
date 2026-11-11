import type { DayData, DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useDayTrackData } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-data'
import ActivityEditor from '../src/renderer/components/04.features/day-track-player/ui/day-track-activity-editor.vue'

const api = vi.hoisted(() => ({ getDay: vi.fn(), correctActivity: vi.fn(), removeCorrection: vi.fn() }))
vi.mock('~/shared/services/database/tracking.service', () => ({ trackingService: api }))
vi.mock('~/shared/services/tracking/geotrack-client', () => ({ deleteStoredPoint: vi.fn() }))
const time = Date.parse('2026-11-10T13:00:00Z')
const points: DayPoint[] = [0, 60_000, 120_000].map(offset => ({
  clientPointId: `point-${offset}`,
  tsUtc: time + offset,
  sessionId: 'session-a',
  lat: 54,
  lng: 48,
  speed: 14,
  accuracy: 7,
  activity: 'walk',
}))
const data: DayData = {
  points,
  rawPoints: points,
  segments: [{
    id: 's',
    sessionId: 'session-a',
    startedAt: time,
    endedAt: time + 120_000,
    activity: 'walk',
    confidence: 0.8,
    geometry: [],
    distanceM: 100,
    pointCount: 3,
  }],
  corrections: [{
    id: 'correction',
    sessionId: 'session-a',
    startedAt: time,
    endedAt: time + 60_000,
    activity: 'vehicle',
    createdAt: time,
  }],
}
const wrapperOptions = {
  props: { visible: false, initialTime: time + 60_000, dayData: data },
  global: {
    stubs: {
      KitDialogWithClose: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
      KitInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }) }),
      KitBtn: defineComponent({ setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }),
      KitRadioGroup: defineComponent({ emits: ['update:modelValue'], setup: (_, { emit }) => () => h('button', { 'type': 'button', 'data-test': 'vehicle', 'onClick': () => emit('update:modelValue', 'vehicle') }, 'Авто') }),
    },
  },
}

beforeEach(() => {
  api.correctActivity.mockReset().mockResolvedValue({ success: true })
  api.removeCorrection.mockReset().mockResolvedValue({ success: true })
})

it('converts local Samara time to UTC for the correct session', async () => {
  const wrapper = mount(ActivityEditor, wrapperOptions)
  await wrapper.setProps({ visible: true })
  const inputs = wrapper.findAll('input')
  expect(inputs[0].element.value).toBe('10.11.2026 17:00:00')
  expect(inputs[1].element.value).toBe('10.11.2026 17:02:00')
  await inputs[0].setValue('10.11.2026 17:00:10')
  await inputs[1].setValue('10.11.2026 17:01:30')
  await wrapper.get('[data-test="vehicle"]').trigger('click')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(api.correctActivity).toHaveBeenCalledWith({ sessionId: 'session-a', startedAt: time + 10_000, endedAt: time + 90_000, activity: 'vehicle' })
  expect(wrapper.emitted('saved')).toHaveLength(1)
  expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  wrapper.unmount()
})

it('shows save errors without closing and supports cancelling a saved correction', async () => {
  const wrapper = mount(ActivityEditor, wrapperOptions)
  await wrapper.setProps({ visible: true })
  api.correctActivity.mockRejectedValueOnce(new Error('Нет соединения'))
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toBe('Нет соединения')
  expect(wrapper.emitted('update:visible')).toBeUndefined()
  await wrapper.findAll('button').find(button => button.text() === 'Отменить')!.trigger('click')
  await flushPromises()
  expect(api.removeCorrection).toHaveBeenCalledWith('correction')
  expect(wrapper.emitted('saved')).toHaveLength(1)
  wrapper.unmount()
})

it('keeps canonical server labels and confidence instead of classifying the day again in the browser', async () => {
  const effectivePoints = Array.from({ length: 40 }, (_, i) => ({
    ...points[0],
    tsUtc: time + i * 5_000,
    lng: 48 + i * 0.00063,
    activity: 'bike',
    recordedActivity: 'walk',
    activityConfidence: 1,
    activitySource: 'manual',
  }))
  api.getDay.mockResolvedValue({ points: effectivePoints, corrections: [], segments: [{ ...data.segments[0], activity: 'bike', activitySource: 'manual', confidence: 1 }] })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/?day=2026-11-10')
  await router.isReady()
  let result: ReturnType<typeof useDayTrackData> | undefined
  const wrapper = mount(defineComponent({
    setup() {
      result = useDayTrackData()

      return () => h('div')
    },
  }), { global: { plugins: [router] } })
  await flushPromises()
  expect(result?.dayData.value?.segments[0].activity).toBe('bike')
  expect(result?.dayData.value?.points[0].activityConfidence).toBe(1)
  expect(result?.dayData.value?.rawPoints?.[0].recordedActivity).toBe('walk')
  wrapper.unmount()
})
