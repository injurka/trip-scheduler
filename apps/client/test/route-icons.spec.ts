import type { MapRoute, TransportMode } from '../src/renderer/components/03.domain/trip-info/geolocation-section/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, reactive, ref } from 'vue'
import GeolocationRouteList from '../src/renderer/components/03.domain/trip-info/geolocation-section/ui/geolocation-route-list.vue'
import GeolocationSection from '../src/renderer/components/03.domain/trip-info/geolocation-section/ui/geolocation-section.vue'

vi.mock('@iconify/vue', () => ({ Icon: defineComponent({ props: ['icon'], setup: props => () => h('i', { 'data-icon': props.icon }) }) }))
vi.mock('~/components/01.kit/kit-btn', () => ({ KitBtn: defineComponent({ setup: () => () => h('button') }) }))
vi.mock('~/components/01.kit/kit-tooltip', () => ({ KitTooltip: defineComponent({ setup: (_, { slots }) => () => slots.default?.() }) }))
vi.mock('~/components/01.kit/kit-inline-md-editor', () => ({ KitInlineMdEditorWrapper: defineComponent({ setup: () => () => h('span') }) }))
vi.mock('~/shared/lib/geo-export', () => ({ exportRouteToGpx: vi.fn() }))
vi.mock('../src/renderer/components/03.domain/trip-info/geolocation-section/ui/geolocation-poi-list.vue', () => ({ default: defineComponent({ setup: () => () => h('div') }) }))

describe('route transport icons', () => {
  it('changes the header icon for every selected mode, including readonly display', async () => {
    const route = reactive<MapRoute>({ id: 'route', title: 'A → B', points: [], isVisible: true, transportMode: 'foot' })
    const wrapper = mount(GeolocationRouteList, {
      props: {
        routes: [route],
        activeRouteId: null,
        onSetTransportMode: (_id: string, mode: TransportMode) => { route.transportMode = mode },
      },
    })
    expect(wrapper.get('.route-mode-icon').attributes('data-icon')).toBe('mdi:walk')
    expect(wrapper.findAll('.transport-btn')).toHaveLength(3)
    const modes = ['foot', 'bike', 'car'] as const
    const icons = ['mdi:walk', 'mdi:bicycle', 'mdi:car']
    for (const index of [2, 1, 0]) {
      await wrapper.findAll('.transport-btn')[index].trigger('click')
      expect(route.transportMode).toBe(modes[index])
      expect(wrapper.get('.route-mode-icon').attributes('data-icon')).toBe(icons[index])
    }
    await wrapper.findAll('.transport-btn')[2].trigger('click')
    await wrapper.setProps({ readonly: true })
    expect(wrapper.get('.route-mode-icon').attributes('data-icon')).toBe('mdi:car')
    expect(wrapper.find('.transport-switcher').exists()).toBe(false)
    wrapper.unmount()
  })
})

vi.mock('~/shared/composables/use-toast', () => ({ useToast: () => ({ error: vi.fn() }) }))
vi.mock('~/shared/services/geo', () => ({
  nominatimService: {},
  routingService: { calculateRoute: vi.fn(async () => ({ geometry: [], distance: 0, duration: 0, isDirect: true })) },
}))
vi.mock('../src/renderer/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue', () => ({
  default: defineComponent({
    emits: ['mapReady'],
    setup(_, { emit }) {
      onMounted(() => emit('mapReady', {
        mapInstance: ref(undefined),
        onPointDragEnd: () => () => {},
        addOrUpdateRoute: vi.fn(),
        removeRoute: vi.fn(),
        addOrUpdatePoint: vi.fn(),
      }))
      return () => h('div')
    },
  }),
}))

it('persists Auto before the debounce and keeps the saved snapshot independent', async () => {
  const wrapper = mount(GeolocationSection, {
    props: {
      section: { id: 'geo', type: 'geolocation', points: [], routes: [{
        id: 'route',
        title: 'A → B',
        transportMode: 'foot',
        isVisible: true,
        points: [{ id: 'a', coordinates: [121.54, 25.15], type: 'start' }, { id: 'b', coordinates: [121.52, 25.08], type: 'end' }],
      }] } as any,
    },
  })
  await flushPromises()
  await wrapper.findAll('.transport-btn')[2].trigger('click')
  const saved = wrapper.emitted('updateSection')?.[0]?.[0] as any
  expect(saved.routes[0].transportMode).toBe('car')
  expect(wrapper.get('.route-mode-icon').attributes('data-icon')).toBe('mdi:car')
  await wrapper.findAll('.transport-btn')[1].trigger('click')
  expect(saved.routes[0].transportMode).toBe('car')
  wrapper.unmount()
})
