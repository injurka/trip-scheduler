import { recordingQuality } from '@limiteddissolve/track-processing'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import Quality from '../src/renderer/components/04.features/day-track-player/ui/day-track-quality.vue'

it('keeps issue details compact, reports measured percentages and seeks to the selected interval', async () => {
  const quality = recordingQuality(Array.from({ length: 100 }, (_, index) => ({ sessionId: 'A', tsUtc: 1000 + index * 60000, accuracy: 5 })))
  const wrapper = mount(Quality, { props: { quality, timeZone: 'UTC' }, global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } } })
  expect(wrapper.findAll('button')).toHaveLength(0)
  const details = wrapper.get('details')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')
  expect(wrapper.findAll('button')).toHaveLength(31)
  await wrapper.findAll('button')[0].trigger('click')
  expect(wrapper.emitted('seek')?.[0][0]).toEqual(quality.issues[0])
  expect(wrapper.text()).toContain('100.0%')
  expect(wrapper.text()).toContain('потеря GPS не подтверждена')
  await wrapper.findAll('button').at(-1)!.trigger('click')
  expect(wrapper.findAll('button')).toHaveLength(61)
  wrapper.unmount()
})
