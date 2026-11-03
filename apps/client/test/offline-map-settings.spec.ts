import type { OfflineMapOptions } from '../src/renderer/shared/lib/offline-map-options'
import type { TripWithDays } from '../src/renderer/shared/types/models/trip'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineMapSettings from '../src/renderer/components/02.shared/offline-manager/ui/offline-map-settings.vue'

vi.mock('../src/renderer/shared/lib/map-styles-sources', () => ({ getEffectiveMapTilerKey: () => '', getCustomTileUrl: () => '', getMapStyle: () => '' }))
const trip = {
  sections: [],
  days: ['day-1', 'day-2'].map(id => ({ id, title: id, activities: [{ sections: [{ type: 'geolocation', points: [{ coordinates: [121, 25] }] }] }] })),
} as unknown as TripWithDays
const wrappers: ReturnType<typeof mount>[] = []
function render() {
  let applyUpdate: (value: OfflineMapOptions) => void = () => {}
  const wrapper = mount(OfflineMapSettings, {
    props: {
      'onUpdate:modelValue': (value: OfflineMapOptions) => applyUpdate(value),
      trip,
      'modelValue': { maxZoom: 15, style: 'osm' },
      'coverage': [{
        areaId: 'day-1',
        title: 'day-1',
        style: 'osm',
        maxZoom: 15,
        terrain: false,
        savedAt: 1,
      }],
    },
    global: {
      stubs: {
        KitBtn: { template: '<button><slot /></button>' },
        KitCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button role="checkbox" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>' },
        KitSelectWithSearch: { props: ['modelValue', 'items', 'label'], emits: ['update:modelValue'], template: '<label>{{ label }}<select :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value) || $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>' },
      },
    },
  })
  applyUpdate = (value) => {
    void wrapper.setProps({ modelValue: value })
  }
  wrappers.push(wrapper)

  return wrapper
}
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
})

describe('offline map selection', () => {
  it('shows saved areas and lets users choose individual days in the same trip', async () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Сохранено')
    expect(wrapper.text()).toContain('Области: 2 из 2')
    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')
    await flushPromises()
    expect(wrapper.props('modelValue').areaIds).toEqual(['day-2'])
    expect(wrapper.text()).toContain('Области: 1 из 2')
  })
  it('updates the estimate when detail changes and allows selecting no areas without losing the trip', async () => {
    const wrapper = render()
    const original = wrapper.find('.map-estimate').text()
    await wrapper.findAll('select')[0].setValue('10')
    await flushPromises()
    expect(wrapper.props('modelValue').maxZoom).toBe(10)
    expect(wrapper.find('.map-estimate').text()).not.toBe(original)
    await wrapper.findAll('button').find(button => button.text() === 'Снять')!.trigger('click')
    await flushPromises()
    expect(wrapper.props('modelValue').areaIds).toEqual([])
    expect(wrapper.text()).toContain('Выберите хотя бы одну область')
  })
})
