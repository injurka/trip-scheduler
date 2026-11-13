import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Widget from '../src/renderer/components/04.features/trip-info/trip-overview/ui/content/trip-statistics-widget.vue'

vi.mock('@iconify/vue', () => ({ Icon: { template: '<svg />' } }))
const api = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }))
vi.mock('~/shared/services/trpc/trpc.service', () => ({ trpc: { trip: { getStatistics: { query: api.query }, refreshStatistics: { mutate: api.mutate } } } }))
vi.mock('~/components/01.kit/kit-btn', () => ({ KitBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' } }))
const saved = {
  computedAt: '2026-11-11T10:00:00Z',
  startDate: '2026-11-11',
  endDate: '2026-11-12',
  photos: 42,
  videos: 2,
  favoritePhotos: 4,
  textMemories: 8,
  notes: 2,
  documents: 3,
  plannedActivities: 7,
  plannedPlaces: 2,
  trackedDays: 0,
  distanceM: {
    walk: 0,
    bike: 0,
    vehicle: 0,
    rail: 0,
    unknown: 0,
  },
  movingDurationMs: 0,
  longestDay: null,
}
const props = { tripId: 'trip', canEdit: true, startDate: saved.startDate, endDate: saved.endDate }

beforeEach(() => {
  api.query.mockReset()
  api.mutate.mockReset()
})
describe('trip statistics widget', () => {
  it('loads the snapshot without triggering a recalculation', async () => {
    api.query.mockResolvedValue(saved)
    const wrapper = mount(Widget, { props })
    await flushPromises()
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('Пока нет загруженных GPS-треков')
    expect(api.mutate).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('creates the first snapshot only when the refresh button is clicked', async () => {
    api.query.mockResolvedValue(null)
    api.mutate.mockResolvedValue(saved)
    const wrapper = mount(Widget, { props })
    await flushPromises()
    expect(wrapper.find('.empty').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(api.mutate).toHaveBeenCalledWith({ tripId: 'trip' })
    expect(wrapper.find('.highlights').exists()).toBe(true)
    wrapper.unmount()
  })
  it('shows refresh controls and calculation metadata only while editing', async () => {
    api.query.mockResolvedValue(saved)
    const wrapper = mount(Widget, { props: { ...props, canEdit: false } })
    await flushPromises()
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Обновлено')
    await wrapper.setProps({ canEdit: true })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('footer').exists()).toBe(true)
    await wrapper.setProps({ canEdit: false })
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(api.query).toHaveBeenCalledTimes(1)
    expect(api.mutate).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps the previous snapshot if recalculation fails', async () => {
    api.query.mockResolvedValue(saved)
    api.mutate.mockRejectedValue(new Error('Попробуйте позже'))
    const wrapper = mount(Widget, { props })
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Попробуйте позже')
    expect(wrapper.find('.highlights').exists()).toBe(true)
    wrapper.unmount()
  })
})
