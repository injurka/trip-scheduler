import type { Memory } from '../src/renderer/shared/types/models/memory'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useDayTrackPhotos } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-photos'
import Panel from '../src/renderer/components/04.features/day-track-player/ui/day-track-playback-panel.vue'

vi.mock('~/shared/lib/thumbhash', () => ({ getImageThumbhash: () => null }))
vi.mock('@iconify/vue', () => ({ Icon: { template: '<svg />' } }))
vi.mock('~/components/01.kit/kit-btn', () => ({ KitBtn: { emits: ['click'], template: '<button @click="$emit(\'click\', $event)"><slot /></button>' } }))
vi.mock('~/components/01.kit/kit-dropdown', () => ({ KitDropdown: { template: '<div><slot name="trigger" /></div>' } }))

const start = Date.parse('2026-11-16T02:00:00Z')
const end = start + 3600000
const photos = useDayTrackPhotos({
  memories: ref([{
    id: 'photo',
    timestamp: new Date(start + 1800000).toISOString(),
    image: { url: 'photo.jpg', latitude: 23.5, longitude: 120.7 },
  } as Memory]),
  dayData: ref(null),
  dayStart: computed(() => start),
  dayEnd: computed(() => end),
})
const props = {
  routeVisibility: 'full' as const,
  trailMinutes: 15,
  timeLabel: '10:00:00',
  timezoneMode: 'track' as const,
  deviceTimezone: 'UTC',
  trackTimezone: 'Asia/Taipei',
  currentActivity: 'still' as const,
  currentActivityColor: '#999',
  currentActivityIcon: 'mdi:pause',
  currentActivityLabel: 'Покой',
  isFollowCamera: false,
  t: start,
  dayStart: start,
  dayEnd: end,
  isPlaying: false,
  speedMultiplier: 2,
}

describe('playback timeline', () => {
  it('hides and restores timeline ticks with map photo visibility, retaining the photo data', () => {
    expect(photos.timelinePhotoMarkers.value).toHaveLength(1)
    photos.isPhotosVisible.value = false
    expect(photos.timelinePhotoMarkers.value).toEqual([])
    expect(photos.locatedPhotos.value).toHaveLength(1)
    photos.isPhotosVisible.value = true
    expect(photos.timelinePhotoMarkers.value).toHaveLength(1)
  })
  it('shares start/middle/end positions and preserves native seek and photo controls', async () => {
    const wrapper = mount(Panel, { props: { ...props, photoMarkers: photos.timelinePhotoMarkers.value } })
    expect(wrapper.get('.timeline-playhead').attributes('style')).toContain('left: 0%')
    await wrapper.setProps({ t: start + 1800000 })
    expect(wrapper.get('.timeline-playhead').attributes('style')).toContain('left: 50%')
    await wrapper.setProps({ t: end })
    expect(wrapper.get('.timeline-playhead').attributes('style')).toContain('left: 100%')
    const tick = wrapper.get('button.timeline-photo-tick')
    expect(tick.attributes('aria-label')).toContain('Перейти к фото')
    await tick.trigger('click')
    expect(wrapper.emitted('seekPhoto')?.[0]).toEqual([start + 1800000])
    await wrapper.get('input[type="range"]').setValue(start + 600000)
    expect(wrapper.emitted('update:t')?.at(-1)).toEqual([start + 600000])
    await wrapper.setProps({ photoMarkers: [] })
    expect(wrapper.find('.timeline-photo-markers').exists()).toBe(false)
    wrapper.unmount()
  })
})

it('opens quality details from the readout icon without expanding the player', async () => {
  const wrapper = mount(Panel, { props, slots: { quality: '<p>Пропуски GPS: 22</p>' }, attachTo: document.body })
  await flushPromises()
  expect(wrapper.text()).not.toContain('Пропуски GPS')
  const trigger = wrapper.get('[aria-label="Качество записи"]')
  expect(trigger.element.closest('.memories-readout')).not.toBeNull()
  await trigger.trigger('click')
  await flushPromises()
  expect(trigger.attributes('aria-expanded')).toBe('true')
  await vi.waitFor(() => expect(document.body.querySelector('.recording-quality-popover')?.textContent).toContain('Пропуски GPS: 22'))
  await trigger.trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(document.body.querySelector('.recording-quality-popover')).toBeNull())
  await trigger.trigger('click')
  await flushPromises()
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await vi.waitFor(() => expect(document.body.querySelector('.recording-quality-popover')).toBeNull())
  wrapper.unmount()
})
