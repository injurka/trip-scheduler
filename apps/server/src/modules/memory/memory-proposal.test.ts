import { describe, expect, it } from 'bun:test'
import { alignExplicitNoteTimes, validateMemoryTargets } from './memory-proposal'
import { MemoryProposalSchema } from './memory.schemas'

const id = '405a53ea-0ccb-4a64-aaaf-a19103b276af'
const block = { type: 'activity' as const, targetId: null, title: 'Прогулка', comment: 'Гуляли по набережной.', time: '10:30', timeEstimated: false, tag: 'walk' as const }

describe('memory proposals', () => {
  it('accepts new activities and linked notes without rewriting existing records', () => {
    const proposal = MemoryProposalSchema.parse({ blocks: [block, { ...block, type: 'note', title: '', comment: 'Заметка' }, { ...block, type: 'note', title: '', targetId: id, comment: 'Остановка была закрыта' }] })
    expect(() => validateMemoryTargets(proposal, new Set([id]))).not.toThrow()
  })

  it('rejects empty output, invalid time and empty activity titles', () => {
    expect(MemoryProposalSchema.safeParse({ blocks: [] }).success).toBe(false)
    for (const patch of [{ time: '24:00' }, { time: '10:90' }, { title: '  ' }, { comment: '  ' }, { targetId: id }])
      expect(MemoryProposalSchema.safeParse({ blocks: [{ ...block, ...patch }] }).success).toBe(false)
    expect(MemoryProposalSchema.safeParse({ blocks: [{ ...block, type: 'description', targetId: id }] }).success).toBe(false)
  })

  it('rejects foreign targets and repeated facts', () => {
    const proposal = MemoryProposalSchema.parse({ blocks: [{ ...block, type: 'note', title: '', targetId: id }] })
    expect(() => validateMemoryTargets(proposal, new Set())).toThrow()
    expect(() => validateMemoryTargets({ blocks: [...proposal.blocks, ...proposal.blocks] }, new Set([id]))).toThrow()
  })
  it('uses the explicit 9:40 in a note instead of the estimated 09:45', () => {
    const proposal = MemoryProposalSchema.parse({ blocks: [{ ...block, type: 'note', title: '', targetId: id, comment: 'В 9:40 не успел на автобус.', time: '09:45', timeEstimated: true }] })
    alignExplicitNoteTimes(proposal)
    expect(proposal.blocks[0]).toMatchObject({ time: '09:40', timeEstimated: false })
  })
})
