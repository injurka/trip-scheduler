import type { Booking } from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookingSection from '../src/renderer/components/04.features/trip-info/trip-sections/booking-section/ui/booking-section.vue'
import { TripsHubKey } from '../src/renderer/components/05.modules/trips-hub/composables'
import TripCard from '../src/renderer/components/05.modules/trips-hub/ui/list-trip/trip-card/card-item.vue'

// Only services and unrelated maps/photos/editors are replaced; cards, buttons, tabs and tooltips are real.
vi.mock('~/shared/composables/use-confirm', () => ({ useConfirm: () => async () => false }))
vi.mock('~/components/04.features/trip-info/trip-plan', () => ({ useTripPlanStore: () => ({ currentTripId: 'trip' }) }))
vi.mock('~/plugins/request', () => ({ useRequest: async () => null }))
vi.mock('~/components/03.domain/geo-place-picker', () => ({ GeoPlacePicker: { render: () => null } }))
vi.mock('~/components/01.kit/kit-map', () => ({ KitMap: { render: () => null } }))
vi.mock('~/components/01.kit/kit-image', () => ({ KitImage: { render: () => null } }))
vi.mock('~/components/04.features/trip-info/trip-comments', () => ({ TripCommentsWidget: { render: () => null } }))
vi.mock('~/components/04.features/trip-info/trip-edit-info-dialog', () => ({ TripEditInfoDialog: { render: () => null } }))
vi.mock('../src/renderer/components/05.modules/trips-hub/composables', () => ({ TripsHubKey: Symbol('tripsHub') }))
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/booking-section/ui/cards/components/booking-photos.vue', () => ({ default: { render: () => null } }))
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/booking-section/ui/dialogs/add-booking-dialog.vue', () => ({ default: { render: () => null } }))
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/booking-section/ui/shared/ai-booking-creator.vue', () => ({ default: { render: () => null } }))

const wrappers: ReturnType<typeof mount>[] = []
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
const now = Date.parse('2026-11-08T10:00:00Z')
function train(id: string, start: number, end?: number): Booking {
  return {
    id,
    title: id,
    icon: 'mdi:train',
    type: 'train',
    data: {
      departureDateTime: new Date(start).toISOString(),
      arrivalDateTime: end === undefined ? undefined : new Date(end).toISOString(),
    },
  }
}
const initialBookings = () => [train('expired', now - 7200000, now - 3600000), train('active', now - 60000, now + 60000), train('next', now + 120000, now + 180000)]
function renderBookings(bookings = initialBookings(), readonly = true) {
  const wrapper = mount(BookingSection, {
    props: { section: { id: 'section', type: 'booking', content: { bookings } }, readonly },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  wrappers.push(wrapper)

  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('booking section with real UI components', () => {
  it('highlights active/next cards and keeps their status text visible in the markup', () => {
    const wrapper = renderBookings()
    expect(wrapper.find('[data-entry-id="active"] .booking-card').classes()).toContain('highlight-active')
    expect(wrapper.find('[data-entry-id="next"] .booking-card').classes()).toContain('highlight-next')
    expect(wrapper.find('[data-entry-id="active"] .status-badge').text()).toContain('Сейчас')
    expect(wrapper.find('[data-entry-id="next"] .status-badge').text()).toContain('Далее')
    expect(wrapper.find('[data-entry-id="expired"] .status-badge').exists()).toBe(false)
  })

  it('allows switching from a type tab to the correct timeline item and focuses it', async () => {
    const wrapper = renderBookings()
    const tabs = wrapper.findAll('.kit-view-switcher button')
    await tabs.find(button => button.text().includes('Поезда'))!.trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(wrapper.find('.bookings-timeline').exists()).toBe(false)
    const jump = wrapper.find('button[aria-label="Перейти к следующему бронированию: next"]')
    expect(jump.exists()).toBe(true)
    await jump.trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.bookings-timeline').exists()).toBe(true)
    expect(document.activeElement?.getAttribute('data-entry-id')).toBe('next')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('defers navigation while tabs animate, then resolves only the latest requested target', async () => {
    const wrapper = renderBookings()
    const tabs = wrapper.findComponent({ name: 'KitTabs' })
    tabs.vm.$emit('beforeLeave')
    await wrapper.find('button[aria-label="Перейти к текущему бронированию: active"]').trigger('click')
    await wrapper.find('button[aria-label="Перейти к следующему бронированию: next"]').trigger('click')
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    tabs.vm.$emit('afterEnter')
    await nextTick()
    await nextTick()
    expect(document.activeElement?.getAttribute('data-entry-id')).toBe('next')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('accepts external edits without emitting them back, but emits local edits as detached snapshots', async () => {
    const wrapper = renderBookings(initialBookings(), false)
    await wrapper.setProps({ section: { id: 'section', type: 'booking', content: { bookings: [train('server', now + 120000, now + 180000)] } } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('updateSection')).toBeUndefined()
    const card = wrapper.findComponent({ name: 'TrainCard' })
    const booking = train('server', now + 120000, now + 180000)
    card.vm.$emit('update:booking', { ...booking, title: 'Local edit' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    const payload = wrapper.emitted('updateSection')![0][0] as { content: { bookings: Booking[] } }
    expect(payload.content.bookings[0].title).toBe('Local edit')
    card.vm.$emit('update:booking', { ...booking, title: 'Second local edit' })
    await nextTick()
    expect(payload.content.bookings[0].title).toBe('Local edit')
  })

  it('does not overwrite a newer local edit with the echoed previous save', async () => {
    const wrapper = renderBookings([train('edit', now + 120000, now + 180000)], false)
    const card = wrapper.findComponent({ name: 'TrainCard' })
    const booking = train('edit', now + 120000, now + 180000)
    card.vm.$emit('update:booking', { ...booking, title: 'First edit' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    const firstSave = wrapper.emitted('updateSection')![0][0] as { id: string, type: 'booking', content: { bookings: Booking[] } }
    card.vm.$emit('update:booking', { ...booking, title: 'Newer edit' })
    await nextTick()
    await wrapper.setProps({ section: firstSave })
    expect(wrapper.findComponent({ name: 'TrainCard' }).props('booking').title).toBe('Newer edit')
    await vi.advanceTimersByTimeAsync(1000)
    const secondSave = wrapper.emitted('updateSection')![1][0] as { content: { bookings: Booking[] } }
    expect(secondSave.content.bookings[0].title).toBe('Newer edit')
  })

  it('reacts to incoming data, clock boundaries and foreground refresh without echoing read-only updates', async () => {
    const wrapper = renderBookings()
    await wrapper.setProps({ section: { id: 'section', type: 'booking', content: { bookings: [train('replacement', now + 120000, now + 180000)] } } })
    expect(wrapper.find('[data-entry-id="active"]').exists()).toBe(false)
    expect(wrapper.find('[data-entry-id="replacement"] .booking-card').classes()).toContain('highlight-next')
    vi.setSystemTime(now + 130000)
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(wrapper.find('[data-entry-id="replacement"] .booking-card').classes()).toContain('highlight-active')
    vi.setSystemTime(now + 190000)
    window.dispatchEvent(new Event('focus'))
    await nextTick()
    expect(wrapper.find('.timeline-navigation').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('updateSection')).toBeUndefined()
  })

  it('handles empty/undated data and missing end times without inventing active durations', () => {
    const wrapper = renderBookings([train('unknown-end', now - 1000), {
      id: 'undated',
      title: '',
      type: 'other',
      icon: '',
      data: {},
    }])
    expect(wrapper.find('.timeline-navigation').exists()).toBe(false)
    expect(wrapper.find('.highlight-active').exists()).toBe(false)
  })

  it('restores bookings when section props roll back after a published save', async () => {
    const original = [train('edit', now + 120000, now + 180000)]
    const wrapper = renderBookings(original, false)
    const card = wrapper.findComponent({ name: 'TrainCard' })
    card.vm.$emit('update:booking', { ...original[0], title: 'Optimistic save' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    const emittedSave = wrapper.emitted('updateSection')![0][0] as { id: string, type: 'booking', content: { bookings: Booking[] } }
    await wrapper.setProps({ section: emittedSave })
    expect(wrapper.findComponent({ name: 'TrainCard' }).props('booking').title).toBe('Optimistic save')

    // Simulate store rollback on server failure
    await wrapper.setProps({ section: { id: 'section', type: 'booking', content: { bookings: original } } })
    await nextTick()
    expect(wrapper.findComponent({ name: 'TrainCard' }).props('booking').title).toBe('edit')
  })

  it('renders conflict warning badges for overlapping bookings in timeline', () => {
    const wrapper = renderBookings([
      train('train-1', now + 60000, now + 3600000),
      train('train-2', now + 1800000, now + 5400000),
    ])
    const badges = wrapper.findAll('.timeline-conflict-badge')
    expect(badges.length).toBeGreaterThanOrEqual(2)
    expect(badges[0].text()).toContain('Пересечение с')
  })
})

describe('trip visibility and ongoing badge', () => {
  it.each([true, false])('preserves visibility independently of ongoing=%s', (isHighlight) => {
    const wrapper = mount(TripCard, {
      props: {
        id: 'trip',
        title: 'Поездка',
        startDate: '2026-11-01',
        endDate: '2026-11-20',
        status: 'planned',
        visibility: 'public',
        cityRefs: [],
        isHighlight,
        imageUrl: '',
        description: '',
        descriptionShort: '',
        budget: 0,
        currency: 'RUB',
        participants: [],
        tags: [],
      },
      global: { plugins: [router], provide: { [TripsHubKey as symbol]: {} } },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('.active-trip-badge').exists()).toBe(isHighlight)
    expect(wrapper.find('.card-visibility').attributes('aria-label')).toBe('Публичное путешествие')
    expect(wrapper.find('.card-visibility').element.closest('.active-trip-badge')).toBeNull()
    expect(wrapper.find('button[aria-label="Еще действия"]').exists()).toBe(true)
  })
})
