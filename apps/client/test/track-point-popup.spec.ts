import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Popup from '../src/renderer/components/04.features/day-track-player/ui/day-track-point-popup.vue'

vi.mock('@iconify/vue', () => ({ Icon: { template: '<svg />' } }))
vi.mock('~/components/01.kit/kit-btn', () => ({ KitBtn: { template: '<button><slot /></button>' } }))
const point = {
  clientPointId: 'one',
  sessionId: 'test',
  tsUtc: 1000,
  lat: 23.50549,
  lng: 120.69916,
  speed: 1.5,
  accuracy: 4,
  altitude: 1478,
  bearing: 329,
  activity: 'unknown' as const,
  activityConfidence: 0.48,
}
const props = {
  selectedPoint: { point, index: 1431, total: 1560 },
  timezoneMode: 'track' as const,
  formattedTime: '14:48:35',
  isCopied: false,
  isDeleting: false,
  statusBadge: null,
}

describe('compact point inspector', () => {
  it('shows essentials first and keeps detailed measurements behind an explicit toggle', async () => {
    const wrapper = mount(Popup, { props })
    expect(wrapper.text()).toContain('14:48:35')
    expect(wrapper.text()).toContain('5.4 км/ч')
    expect(wrapper.text()).toContain('≈ 4 м')
    expect(wrapper.find('.classification-note').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Удалить точку"]').exists()).toBe(false)
    await wrapper.get('[aria-expanded]').trigger('click')
    expect(wrapper.text()).toContain('1478 м')
    expect(wrapper.text()).toContain('329°')
    expect(wrapper.find('.classification-note').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Удалить точку"]').exists()).toBe(true)
    await wrapper.setProps({ selectedPoint: { point: { ...point, clientPointId: 'two' }, index: 2, total: 1560 } })
    expect(wrapper.get('[aria-expanded]').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
  it('keeps copying available without expanding and hides editing for viewers', async () => {
    const wrapper = mount(Popup, { props: { ...props, readonly: true } })
    expect(wrapper.find('[aria-label="Исправить движение"]').exists()).toBe(false)
    await wrapper.get('.coords-card').trigger('click')
    expect(wrapper.emitted('copy')?.[0]).toEqual([point])
    await wrapper.get('[aria-expanded]').trigger('click')
    expect(wrapper.find('[aria-label="Удалить точку"]').exists()).toBe(false)
    await wrapper.get('[aria-label="Закрыть"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
