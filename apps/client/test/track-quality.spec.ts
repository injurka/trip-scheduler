import { recordingQuality } from '@limiteddissolve/track-processing'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import Quality from '../src/renderer/components/04.features/day-track-player/ui/day-track-quality.vue'

vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))

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

it('groups nearby noisy fixes, analyzes with AI and previews the specific action', async () => {
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
  const analyzeButton = wrapper.findAll('.quality-issue button').filter(button => button.text().trim() === 'Проверить с ИИ')
  expect(analyzeButton).toHaveLength(1)
  await analyzeButton[0].trigger('click')
  await flushPromises()
  expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ startedAt: 6000, endedAt: 21000, points: 2 }))
  expect(wrapper.text()).toContain('Сигналы указывают на остановку.')
  expect(preview).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text().includes('Сгладить дрейф на остановке'))!.trigger('click')
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ startedAt: 6000 }), 'collapse-drift')
  wrapper.unmount()
})

it('hides coherent low-accuracy points and stationary pauses instead of cluttering the review dialog', async () => {
  const rawPoints = trackPoints([8, 65, 8], [0, 0.00003, 0.00005])
  const quality = recordingQuality(rawPoints)
  const analyze = vi.fn()
  const wrapper = mount(Quality, {
    props: { quality, rawPoints, analyze, timeZone: 'UTC' },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })

  expect(wrapper.text()).toContain('Маршрут в порядке')
  expect(wrapper.findAll('.quality-issue')).toHaveLength(0)
  expect(analyze).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('runs smart AI normalization across complex sections and stages outlier exclusions and activity fixes', async () => {
  const complex = trackPoints([8, 58, 56, 54, 8], [0, 0.0006, 0.0012, 0.0015, 0.002]).map((p, i) => ({
    ...p,
    lat: i === 2 ? 0.0005 : 0,
    activity: 'unknown' as const,
    deviceActivity: null,
    deviceActivityConfidence: null,
  }))
  const pending = trackPoints([8, 60, 8], [0, 0.0014, 0.00001], true).map(p => ({ ...p, sessionId: 'pending' }))
  const rawPoints = [...pending, ...complex]
  const analyze = vi.fn().mockResolvedValue({
    action: 'exclude-manual',
    excludedTimestamps: [complex[2].tsUtc],
    suggestedActivity: 'bus',
    reason: 'Убран одиночный выброс и определён автобус по скорости.',
    affectedFixes: 1,
  })
  const previewBatch = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Quality, {
    props: {
      quality: recordingQuality(rawPoints),
      rawPoints,
      analyze,
      previewBatch,
      timeZone: 'UTC',
    },
    global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } },
  })

  const smartBtn = wrapper.findAll('button').find(button => button.text().includes('Нормализовать с ИИ'))!
  expect(smartBtn).toBeDefined()
  await smartBtn.trigger('click')
  await flushPromises()

  expect(analyze).toHaveBeenCalledOnce()
  expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'test-session' }))
  expect(previewBatch).toHaveBeenCalledWith([
    expect.objectContaining({
      issue: expect.objectContaining({ sessionId: 'test-session' }),
      action: 'exclude-manual',
      excludedTimestamps: [complex[2].tsUtc],
      suggestedActivity: 'bus',
    }),
  ])
  expect(wrapper.text()).toContain('Дождитесь синхронизации точек с сервером')
  wrapper.unmount()
})
