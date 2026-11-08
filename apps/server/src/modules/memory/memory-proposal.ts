import type { z } from 'zod'
import type { MemoryProposalSchema } from './memory.schemas'
import { createTRPCError } from '~/lib/trpc'

export function validateMemoryTargets(proposal: z.infer<typeof MemoryProposalSchema>, ids: Set<string>) {
  const seen = new Set<string>()
  for (const block of proposal.blocks) {
    if (block.type !== 'description')
      continue
    if (!block.targetId || !ids.has(block.targetId) || seen.has(block.targetId))
      throw createTRPCError('BAD_REQUEST', 'Описание должно относиться к одному существующему блоку выбранного дня.')
    seen.add(block.targetId)
  }
}
