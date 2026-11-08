import type { z } from 'zod'
import type { ApplyMemoriesInputSchema } from './memory.schemas'
import { db } from 'db'
import { memories } from 'db/schema'
import { and, eq, gte, lt } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { createTRPCError } from '~/lib/trpc'
import { dayService } from '~/modules/day/day.service'
import { memoryGenerationService } from '~/services/llm/memory-generation.service'
import { validateMemoryTargets } from './memory-proposal'

async function getContext(dayId: string, userId: string, role: string) {
  const day = await dayService.getByIdForGeneration(dayId, userId, role)
  if (!day.date)
    throw createTRPCError('BAD_REQUEST', 'У дня нет даты.')
  const date = new Date(day.date).toISOString().slice(0, 10)
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 86400000)
  return { day, date, start, end }
}

export const memoryDraftService = {
  async generate(dayId: string, text: string, userId: string, role: string) {
    const { day, start, end } = await getContext(dayId, userId, role)
    const existing = await measureDbQuery('memories', 'select', () => db.select({
      id: memories.id,
      title: memories.title,
      comment: memories.comment,
      timestamp: memories.timestamp,
    }).from(memories).where(and(eq(memories.tripId, day.tripId), gte(memories.timestamp, start), lt(memories.timestamp, end))))
    const proposal = await memoryGenerationService.generate(userId, text, JSON.stringify({ date: day.date, existing }))
    validateMemoryTargets(proposal, new Set(existing.map(m => m.id)))
    return proposal
  },
  async apply(input: z.infer<typeof ApplyMemoriesInputSchema>, userId: string, role: string) {
    const { day, date, start, end } = await getContext(input.dayId, userId, role)
    return measureDbQuery('memories', 'transaction', () => db.transaction(async (tx) => {
      const existing = await tx.select({ id: memories.id }).from(memories).where(and(eq(memories.tripId, day.tripId), gte(memories.timestamp, start), lt(memories.timestamp, end))).for('update')
      validateMemoryTargets(input, new Set(existing.map(m => m.id)))
      for (const block of input.blocks) {
        if (block.type === 'description') {
          await tx.update(memories).set({ comment: block.comment, updatedAt: new Date() }).where(and(eq(memories.id, block.targetId!), eq(memories.tripId, day.tripId)))
        }
        else {
          await tx.insert(memories).values({
            tripId: day.tripId,
            title: block.type === 'activity' ? block.title : null,
            comment: block.comment,
            timestamp: new Date(`${date}T${block.time}:00.000Z`),
            tag: block.type === 'activity' ? block.tag : null,
          })
        }
      }
      return tx.query.memories.findMany({ where: eq(memories.tripId, day.tripId), with: { image: true } })
    }))
  },
}
