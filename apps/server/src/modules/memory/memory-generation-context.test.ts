import { describe, expect, it } from 'bun:test'
import { buildMemoryTimeline } from './memory-generation-context'
import { validateMemoryTargets } from './memory-proposal'

const base = { id: 'note', title: null, comment: 'После поезда пошёл дождь у бамбуковой рощи.', timestamp: new Date('2026-11-14T14:00:00Z'), tag: null, tags: ['дождь'], imageId: null, sourceActivityId: null, plannedTitle: null, plannedStart: null, plannedEnd: null }

describe('memory generation timeline', () => {
  it('keeps notes, media captions and plan links with actual and scheduled time separately', () => {
    const timeline = buildMemoryTimeline([
      base,
      { ...base, id: 'train', title: 'Лесная железная дорога', sourceActivityId: 'plan-train', plannedTitle: 'Поезд до Алишаня', plannedStart: '10:00', plannedEnd: '12:00', timestamp: new Date('2026-11-14T11:30:00Z') },
      { ...base, id: 'photo', imageId: 'image', comment: 'У входа в рощу' },
    ], '2026-11-14')
    expect(timeline[0]).toMatchObject({ type: 'note', time: '14:00', comment: base.comment, tags: ['дождь'], editable: true })
    expect(timeline[1]).toMatchObject({ time: '11:30', sourceActivity: { id: 'plan-train', title: 'Поезд до Алишаня', startTime: '10:00', endTime: '12:00' } })
    expect(timeline[2]).toMatchObject({ type: 'media', comment: 'У входа в рощу' })
  })
  it('includes other days and undated memories as context without making them editable', () => {
    const timeline = buildMemoryTimeline([base, { ...base, id: 'yesterday', timestamp: new Date('2026-11-13T15:00:00Z') }, { ...base, id: 'unsorted', timestamp: null }], '2026-11-14')
    expect(timeline).toHaveLength(3)
    expect(timeline[1]).toMatchObject({ date: '2026-11-13', editable: false })
    expect(timeline[2]).toMatchObject({ date: null, time: null, editable: false })
    const allowed = new Set(timeline.filter(m => m.editable).map(m => m.id))
    const block = { type: 'description' as const, targetId: 'yesterday', title: '', comment: 'Изменение', time: '15:00', timeEstimated: false, tag: 'activity' as const }
    expect(() => validateMemoryTargets({ blocks: [block] }, allowed)).toThrow()
    expect(() => validateMemoryTargets({ blocks: [{ ...block, targetId: 'note' }] }, allowed)).not.toThrow()
  })
})
