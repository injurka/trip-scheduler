import { recordingQuality } from '@limiteddissolve/track-processing'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import Quality from '../src/renderer/components/04.features/day-track-player/ui/day-track-quality.vue'

vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))

it('keeps issue details compact, reports measured percentages and seeks to the selected interval', async () => {
  const quality = recordingQuality(Array.from({ length: 100 }, (_, index) => ({ sessionId: 'A', tsUtc: 1000 + index * 60000, accuracy: 5 })))
  const wrapper = mount(Quality, { props: { quality, timeZone: 'UTC', summaryOnly: true }, global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } } })
  expect(wrapper.findAll('.quality-issue')).toHaveLength(0)
  expect(wrapper.text()).toContain('100.0%')
  expect(wrapper.text()).toContain('потеря GPS не подтверждена')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('review')).toHaveLength(1)
  await wrapper.setProps({ summaryOnly: false })
  expect(wrapper.findAll('.quality-issue')).toHaveLength(30)
  await wrapper.get('.quality-issue-link').trigger('click')
  expect(wrapper.emitted('seek')?.[0][0]).toEqual(quality.issues[0])
  await wrapper.findAll('button').at(-1)!.trigger('click')
  expect(wrapper.findAll('.quality-issue')).toHaveLength(60)
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

it('summarizes coherent GPS fixes without offering AI', async () => {
  const rawPoints = trackPoints([8, 65, 8], [0, 0.00003, 0.00001])
  const quality = recordingQuality(rawPoints)
  const analyze = vi.fn()
  const wrapper = mount(Quality, {
    props: { quality, rawPoints, analyze, timeZone: 'UTC' },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })

  expect(wrapper.text()).toContain('Точки согласуются с маршрутом. Правка не нужна.')
  expect(wrapper.findAll('button').some(button => button.text() === 'Проверить с ИИ')).toBe(false)
  expect(wrapper.findAll('.quality-issue')).toHaveLength(0)
  expect(analyze).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('previews day proposals together and keeps declined or pending sections for manual review', async () => {
  const eligible = trackPoints([8, 65, 8], [0, 0.0014, 0.00001])
  const second = eligible.map(p => ({ ...p, sessionId: 'second' }))
  const pending = trackPoints([8, 65, 8], [0, 0.0014, 0.00001], true).map(p => ({ ...p, sessionId: 'pending' }))
  const rawPoints = [...pending, ...eligible, ...second]
  const analyze = vi.fn().mockResolvedValue({ action: null, reason: 'По оценке ИИ лучше сохранить маршрут.', affectedFixes: 0 })
  const preview = vi.fn().mockResolvedValue(undefined)
  const previewBatch = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Quality, {
    props: {
      quality: recordingQuality(rawPoints),
      rawPoints,
      analyze,
      preview,
      previewBatch,
      timeZone: 'UTC',
    },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })

  const batchButton = () => wrapper.findAll('button').find(button => button.text().startsWith('Предпросмотр правок за день'))!
  expect(batchButton().text()).toContain('· 2')
  await batchButton().trigger('click')
  await flushPromises()
  expect(previewBatch).toHaveBeenCalledWith([
    expect.objectContaining({ issue: expect.objectContaining({ sessionId: 'test-session' }) }),
    expect.objectContaining({ issue: expect.objectContaining({ sessionId: 'second' }) }),
  ])
  const firstRow = wrapper.findAll('.quality-issue')[0]
  await firstRow.findAll('button').find(button => button.text() === 'Проверить с ИИ')!.trigger('click')
  await flushPromises()
  expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'test-session' }))
  expect(batchButton().text()).toContain('· 1')
  await wrapper.findAll('button').find(button => button.text().startsWith('Нужно посмотреть'))!.trigger('click')
  expect(wrapper.text()).toContain('По оценке ИИ лучше сохранить маршрут.')
  expect(wrapper.text()).toContain('Дождитесь синхронизации GPS-точек.')
  expect(wrapper.findAll('button').some(button => button.text() === 'Проверить с ИИ')).toBe(false)
  wrapper.unmount()
})

it('selects points without recalculation and previews the entire selection once', async () => {
  const rawPoints = trackPoints([8, 65, 65, 8], [0, 0.00022, 0.00027, 0.00001])
  const previewBatch = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Quality, {
    props: { quality: recordingQuality(rawPoints), rawPoints, previewBatch },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })

  await wrapper.findAll('button').find(button => button.text() === 'Точки участка')!.trigger('click')
  const checkboxes = wrapper.findAll('input[type="checkbox"]')

  expect(checkboxes).toHaveLength(2)
  await checkboxes[0].setValue(true)
  expect(previewBatch).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === 'Выбрать все')!.trigger('click')
  expect(checkboxes.every(checkbox => (checkbox.element as HTMLInputElement).checked)).toBe(true)
  expect(previewBatch).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === 'Предпросмотр · 2')!.trigger('click')
  expect(previewBatch).toHaveBeenCalledExactlyOnceWith([
    { issue: expect.objectContaining({ startedAt: 6000, endedAt: 6000 }), action: 'exclude-manual' },
    { issue: expect.objectContaining({ startedAt: 11000, endedAt: 11000 }), action: 'exclude-manual' },
  ])
  wrapper.unmount()
})
