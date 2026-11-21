import { calendarDayBounds, inspectTrackGeometry, trackGeometryActions } from '@limiteddissolve/track-processing'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'
import { GetTrackDayInputSchema } from './tracking.schemas'

export const TrackQualityAnalysisInput = GetTrackDayInputSchema.extend({
  tripId: z.string().uuid().optional(),
  sessionId: z.string().min(4).max(64),
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive(),
}).refine(input => input.endedAt >= input.startedAt && input.endedAt - input.startedAt <= 120_000)

export const TrackQualityAnalysisOutput = z.object({
  action: z.enum(trackGeometryActions).nullable(),
  reason: z.string(),
  affectedFixes: z.number().int().nonnegative(),
})

const ModelDecision = z.object({
  decision: z.enum(['suggest', 'keep', 'insufficient']),
  reason: z.string().trim().min(1).max(400),
})

export async function analyzeTrackQuality(userId: string, ownerId: string, input: z.infer<typeof TrackQualityAnalysisInput>) {
  const { from, to } = calendarDayBounds(input.dayUtc, input.timeZone)
  const { startedAt, endedAt } = input
  const [context, saved] = await Promise.all([
    db.select().from(trackPoints).where(and(
      eq(trackPoints.userId, ownerId),
      eq(trackPoints.sessionId, input.sessionId),
      gte(trackPoints.tsUtc, new Date(Math.max(from.getTime(), startedAt - 30_000))),
      lte(trackPoints.tsUtc, new Date(Math.min(to.getTime() - 1, endedAt + 30_000))),
    )).orderBy(trackPoints.tsUtc),
    db.select({ id: trackActivityCorrections.id }).from(trackActivityCorrections).where(and(
      eq(trackActivityCorrections.userId, ownerId),
      eq(trackActivityCorrections.sessionId, input.sessionId),
      isNotNull(trackActivityCorrections.geometryAction),
      lte(trackActivityCorrections.startedAt, new Date(endedAt)),
      gte(trackActivityCorrections.endedAt, new Date(startedAt)),
    )).limit(1),
  ])
  const candidate = inspectTrackGeometry(context.map(p => ({ ...p, tsUtc: p.tsUtc.getTime() })), startedAt, endedAt)
  if (!candidate || saved.length) {
    return {
      action: null,
      reason: saved.length ? 'Для этого участка уже сохранена правка GPS.' : 'По соседним замерам нельзя предложить надёжную правку.',
      affectedFixes: 0,
    }
  }

  await quotaService.checkLlmCreditQuota(userId)
  const completion = await createAiChatRequest({
    system: 'Проверь предложенную правку GPS-трека. exclude-spike исключает одиночный выброс между двумя надёжными точками. collapse-drift переносит неточные точки остановки к надёжной точке перед ней. Оцени, подтверждают ли замеры правку и нет ли признаков реального движения. При противоречивых или недостаточных данных воздержись. Верни JSON с полями decision (suggest, keep или insufficient) и reason (краткое объяснение по-русски, до 400 символов). Не выдумывай места, события и измерения.',
    user: JSON.stringify({ action: candidate.action, ...candidate.evidence }),
  }, {
    model: DEFAULT_AI_MODEL,
    temperature: 0,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  })

  if (completion.usage) {
    const model = AI_MODELS.find(id => completion.model?.includes(id)) ?? DEFAULT_AI_MODEL
    const { prompt_tokens: inputTokens, completion_tokens: outputTokens } = completion.usage
    await quotaService.deductLlmCredits(userId, model, inputTokens, outputTokens)
    await llmUsageRepository.create({ userId, model, operation: 'trackQualityAnalysis', inputTokens, outputTokens })
  }

  const content = completion.choices[0]?.message.content
  const result = parseDecision(content)
  return {
    action: result.decision === 'suggest' ? candidate.action : null,
    reason: result.reason,
    affectedFixes: result.decision === 'suggest' ? candidate.affected.length : 0,
  }
}

function parseDecision(content: string | null | undefined) {
  try {
    return ModelDecision.parse(JSON.parse(content ?? ''))
  }
  catch {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'ИИ не вернул корректный результат. Попробуйте ещё раз.' })
  }
}
