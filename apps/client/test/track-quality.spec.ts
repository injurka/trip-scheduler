import { recordingQuality } from '@limiteddissolve/track-processing'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import Quality from '../src/renderer/components/04.features/day-track-player/ui/day-track-quality.vue'

vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))

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

it('groups nearby noisy fixes and previews only an explicitly selected AI suggestion', async () => {
  const quality = recordingQuality([5, 60, 8, 50, 9].map((accuracy, i) => ({
    sessionId: 'test-session',
    tsUtc: 1000 + i * 5000,
    accuracy,
  })))
  const analyze = vi.fn().mockResolvedValue({ action: 'collapse-drift', reason: 'Сигналы указывают на остановку.', affectedFixes: 2 })
  const preview = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Quality, {
    props: { quality, analyze, preview, timeZone: 'UTC' },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })
  const details = wrapper.get('details')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')
  const analyzeButton = wrapper.findAll('button').filter(button => button.text() === 'Проверить с ИИ')
  expect(analyzeButton).toHaveLength(1)
  await analyzeButton[0].trigger('click')
  await flushPromises()
  expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ startedAt: 6000, endedAt: 21000, points: 2 }))
  expect(wrapper.text()).toContain('Сигналы указывают на остановку.')
  expect(preview).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === 'Предпросмотр на карте')!.trigger('click')
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ startedAt: 6000 }), 'collapse-drift')
  wrapper.unmount()
})
