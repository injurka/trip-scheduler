import { describe, expect, it } from 'bun:test'
import { validateMemoryTargets } from './memory-proposal'
import { MemoryProposalSchema } from './memory.schemas'

const id = '405a53ea-0ccb-4a64-aaaf-a19103b276af'
const block = { type: 'activity' as const, targetId: null, title: 'Прогулка', comment: 'Гуляли по набережной.', time: '10:30', timeEstimated: false, tag: 'walk' as const }

describe('memory proposals', () => {
  it('accepts activities, notes and existing descriptions together', () => {
    const proposal = MemoryProposalSchema.parse({ blocks: [block, { ...block, type: 'note', title: '' }, { ...block, type: 'description', targetId: id }] })
    expect(() => validateMemoryTargets(proposal, new Set([id]))).not.toThrow()
  })

  it('rejects empty output, invalid time and empty activity titles', () => {
    expect(MemoryProposalSchema.safeParse({ blocks: [] }).success).toBe(false)
    for (const patch of [{ time: '24:00' }, { time: '10:90' }, { title: '  ' }, { comment: '  ' }, { targetId: id }])
      expect(MemoryProposalSchema.safeParse({ blocks: [{ ...block, ...patch }] }).success).toBe(false)
    expect(MemoryProposalSchema.safeParse({ blocks: [{ ...block, type: 'description' }] }).success).toBe(false)
  })

  it('rejects foreign, deleted and duplicate description targets', () => {
    const proposal = MemoryProposalSchema.parse({ blocks: [{ ...block, type: 'description', targetId: id }] })
    expect(() => validateMemoryTargets(proposal, new Set())).toThrow()
    expect(() => validateMemoryTargets({ blocks: [...proposal.blocks, ...proposal.blocks] }, new Set([id]))).toThrow()
  })
})
