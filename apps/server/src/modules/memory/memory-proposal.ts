import type { z } from 'zod'
import type { MemoryProposalSchema } from './memory.schemas'
import { createTRPCError } from '~/lib/trpc'

export function validateMemoryTargets(proposal: z.infer<typeof MemoryProposalSchema>, ids: Set<string>) {
  const seen = new Set<string>()
  for (const block of proposal.blocks) {
    if (block.targetId && (block.type !== 'note' || !ids.has(block.targetId)))
      throw createTRPCError('BAD_REQUEST', 'Заметка должна относиться к существующей активности выбранного дня.')
    const content = block.comment.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    if (seen.has(content))
      throw createTRPCError('BAD_REQUEST', 'Одно событие не должно повторяться в нескольких блоках.')
    seen.add(content)
  }
}

/** A single explicit clock time in a note takes precedence over an AI estimate. */
export function alignExplicitNoteTimes(proposal: z.infer<typeof MemoryProposalSchema>) {
  for (const block of proposal.blocks) {
    if (block.type !== 'note')
      continue
    const times = [...block.comment.matchAll(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)]
    const unique = new Set(times.map(match => `${match[1].padStart(2, '0')}:${match[2]}`))
    if (unique.size === 1) {
      block.time = [...unique][0]
      block.timeEstimated = false
    }
  }
}
