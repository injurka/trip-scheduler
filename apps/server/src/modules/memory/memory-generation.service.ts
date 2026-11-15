import type { z } from 'zod'
import type { ApplyMemoriesInputSchema } from './memory.schemas'
import { db } from 'db'
import { activities, days, memories } from 'db/schema'
import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { createTRPCError } from '~/lib/trpc'
import { dayService } from '~/modules/day/day.service'
import { memoryGenerationService } from '~/services/llm/memory-generation.service'
import { buildMemoryTimeline } from './memory-generation-context'
import { alignExplicitNoteTimes, validateMemoryTargets } from './memory-proposal'

interface GeoPointLike {
  title?: string
}

interface SectionLike {
  type?: string
  content?: string
  points?: GeoPointLike[]
}

function extractSectionHighlights(sections?: unknown): string[] {
  if (!sections || !Array.isArray(sections))
    return []
  const highlights: string[] = []
  for (const s of sections as SectionLike[]) {
    if (s.type === 'text' && typeof s.content === 'string' && s.content.trim()) {
      highlights.push(s.content.trim().slice(0, 150))
    }
    else if (s.type === 'geolocation' && Array.isArray(s.points)) {
      for (const p of s.points) {
        if (typeof p?.title === 'string' && p.title.trim())
          highlights.push(p.title.trim())
      }
    }
  }
  return highlights
}

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
    const { day, date } = await getContext(dayId, userId, role)
    const [existing, dayActivities] = await Promise.all([
      measureDbQuery('memories', 'select', () => db.select({
        id: memories.id,
        title: memories.title,
        comment: memories.comment,
        timestamp: memories.timestamp,
        parentMemoryId: memories.parentMemoryId,
        tag: memories.tag,
        tags: memories.tags,
        imageId: memories.imageId,
        sourceActivityId: memories.sourceActivityId,
        plannedTitle: activities.title,
        plannedStart: activities.startTime,
        plannedEnd: activities.endTime,
      }).from(memories).leftJoin(activities, and(eq(memories.sourceActivityId, activities.id), inArray(activities.dayId, db.select({ id: days.id }).from(days).where(eq(days.tripId, day.tripId))))).where(eq(memories.tripId, day.tripId)).orderBy(memories.timestamp, memories.createdAt)),
      measureDbQuery('activities', 'select', () => db.query.activities.findMany({
        where: eq(activities.dayId, dayId),
        columns: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          tag: true,
          sections: true,
        },
        orderBy: activities.startTime,
      })),
    ])

    const trip = (day as Record<string, unknown>).trip as { title?: unknown, description?: unknown } | undefined
    const tripTitle = typeof trip?.title === 'string' ? trip.title : undefined
    const tripDescription = typeof trip?.description === 'string' ? trip.description : undefined

    const timeline = buildMemoryTimeline(existing, date)
    const contextPayload = {
      tripTitle,
      tripDescription,
      dayDate: day.date,
      dayTitle: day.title,
      dayDescription: day.description || undefined,
      dayNote: day.note || undefined,
      plannedActivities: dayActivities.map(a => ({
        id: a.id,
        title: a.title,
        time: `${a.startTime} - ${a.endTime}`,
        tag: a.tag,
        highlights: extractSectionHighlights(a.sections),
      })),
      existingMemories: timeline,
    }

    const proposal = await memoryGenerationService.generate(userId, text, JSON.stringify(contextPayload))
    alignExplicitNoteTimes(proposal)
    validateMemoryTargets(proposal, new Set(timeline.filter(m => m.editable && m.type === 'activity').map(m => m.id)))
    return proposal
  },
  async apply(input: z.infer<typeof ApplyMemoriesInputSchema>, userId: string, role: string) {
    const { day, date, start, end } = await getContext(input.dayId, userId, role)
    return measureDbQuery('memories', 'transaction', () => db.transaction(async (tx) => {
      const existing = await tx.select({ id: memories.id, title: memories.title }).from(memories).where(and(eq(memories.tripId, day.tripId), gte(memories.timestamp, start), lt(memories.timestamp, end))).for('update')
      validateMemoryTargets(input, new Set(existing.filter(m => m.title).map(m => m.id)))
      for (const block of input.blocks) {
        await tx.insert(memories).values({
          tripId: day.tripId,
          parentMemoryId: block.type === 'note' ? block.targetId : null,
          title: block.type === 'activity' ? block.title : null,
          comment: block.comment,
          timestamp: new Date(`${date}T${block.time}:00.000Z`),
          tag: block.type === 'activity' ? block.tag : null,
        })
      }
      return tx.query.memories.findMany({ where: eq(memories.tripId, day.tripId), with: { image: true } })
    }))
  },
}
