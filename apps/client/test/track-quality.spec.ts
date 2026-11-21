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
  const rawPoints = trackPoints([5, 60, 8, 50, 9], [0, 0.0008, 0, 0.0009, 0])
  const quality = recordingQuality(rawPoints)
  const analyze = vi.fn().mockResolvedValue({ action: 'collapse-drift', reason: 'Сигналы указывают на остановку.', affectedFixes: 2 })
  const preview = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Quality, {
    props: {
      quality,
      rawPoints,
      analyze,
      preview,
      timeZone: 'UTC',
    },
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

function trackPoints(accuracy: number[], longitudes: number[], pending = false) {
  return accuracy.map((a, i) => ({
    sessionId: 'test-session',
    clientPointId: `point-${i}`,
    tsUtc: 1000 + i * 5000,
    accuracy: a,
    lat: 0,
    lng: longitudes[i],
    speed: 0,
    activity: 'still' as const,
    deviceActivity: 'still' as const,
    deviceActivityConfidence: 90,
    localPending: pending,
  }))
}

it('explains ineligible sections without offering AI and retains the map shortcut', async () => {
  const rawPoints = trackPoints([8, 65, 8], [0, 0.00003, 0.00001])
  const quality = recordingQuality(rawPoints)
  const analyze = vi.fn()
  const wrapper = mount(Quality, {
    props: { quality, rawPoints, analyze, timeZone: 'UTC' },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })
  const details = wrapper.get('details')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')

  expect(wrapper.text()).toContain('Подходящих участков для проверки с ИИ нет.')
  expect(wrapper.text()).toContain('не удалось выделить короткое отклонение')
  expect(wrapper.findAll('button').some(button => button.text() === 'Проверить с ИИ')).toBe(false)
  await wrapper.get('button[title="Посмотреть участок на карте"]').trigger('click')
  expect(wrapper.emitted('seek')?.[0][0]).toEqual(quality.issues[0])
  expect(analyze).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('prioritizes eligible sections before pagination, skips pending points and remembers an AI decline', async () => {
  const inaccurate = Array.from({ length: 32 }, (_, i) => trackPoints([8, 65, 65, 8], [0, 0.00003, 0.00004, 0.00001])
    .map(p => ({ ...p, sessionId: `noise-${i}` }))).flat()
  const eligible = trackPoints([8, 65, 8], [0, 0.0014, 0.00001])
  const pending = trackPoints([8, 65, 8], [0, 0.0014, 0.00001], true).map(p => ({ ...p, sessionId: 'pending' }))
  const rawPoints = [...inaccurate, ...pending, ...eligible]
  const analyze = vi.fn().mockResolvedValue({ action: null, reason: 'По оценке ИИ лучше сохранить маршрут.', affectedFixes: 0 })
  const wrapper = mount(Quality, {
    props: { quality: recordingQuality(rawPoints), rawPoints, analyze, timeZone: 'UTC' },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })
  const details = wrapper.get('details')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')

  expect(wrapper.text()).toContain('Можно проверить с ИИ: 1')
  const firstRow = wrapper.findAll('.quality-issue')[0]
  await firstRow.findAll('button').find(button => button.text() === 'Проверить с ИИ')!.trigger('click')
  await flushPromises()
  expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'test-session' }))
  expect(firstRow.text()).toContain('По оценке ИИ лучше сохранить маршрут.')
  expect(firstRow.text()).toContain('Проверено ИИ')
  expect(firstRow.findAll('button').some(button => button.text() === 'Проверить с ИИ')).toBe(false)

  await wrapper.findAll('button').at(-1)!.trigger('click')
  expect(wrapper.text()).toContain('Дождитесь синхронизации GPS-точек.')
  wrapper.unmount()
})
