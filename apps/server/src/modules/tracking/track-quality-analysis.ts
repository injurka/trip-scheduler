import { buildTrackIssueAiContext, calendarDayBounds, explainTrackGeometry, inspectTrackGeometry, trackGeometryActions, trackGeometryContextMs } from '@limiteddissolve/track-processing'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'
import { GetTrackDayInputSchema, TrackActivityTypeSchema } from './tracking.schemas'

export const TrackQualityAnalysisInput = GetTrackDayInputSchema.extend({
  tripId: z.string().uuid().optional(),
  sessionId: z.string().min(4).max(64),
  startedAt: z.number().int().positive(),
  endedAt: z.number().int().positive(),
}).refine(input => input.endedAt >= input.startedAt && input.endedAt - input.startedAt <= 300_000)

export const TrackQualityAnalysisOutput = z.object({
  action: z.enum(trackGeometryActions).nullable(),
  reason: z.string(),
  affectedFixes: z.number().int().nonnegative(),
  excludedTimestamps: z.array(z.number().int().positive()).optional(),
  suggestedActivity: TrackActivityTypeSchema.nullable().optional(),
})

const ModelDecision = z.object({
  decision: z.enum(['suggest', 'keep', 'insufficient']),
  reason: z.string().trim().min(1).max(400),
})

const ComplexIssueDecision = z.object({
  decision: z.enum(['exclude_points', 'set_activity', 'both', 'keep', 'insufficient']),
  excludeOffsets: z.array(z.number().int().nonnegative()).max(40).optional(),
  suggestedActivity: TrackActivityTypeSchema.nullable().optional(),
  reason: z.string().trim().min(1).max(400),
})

async function recordCompletionUsage(
  userId: string,
  completion: Awaited<ReturnType<typeof createAiChatRequest>>,
) {
  if (!completion.usage)
    return
  const model = AI_MODELS.find(id => completion.model?.includes(id)) ?? DEFAULT_AI_MODEL
  const { prompt_tokens: inputTokens, completion_tokens: outputTokens } = completion.usage
  await quotaService.deductLlmCredits(userId, model, inputTokens, outputTokens)
  await llmUsageRepository.create({ userId, model, operation: 'trackQualityAnalysis', inputTokens, outputTokens })
}

export async function analyzeTrackQuality(userId: string, ownerId: string, input: z.infer<typeof TrackQualityAnalysisInput>) {
  const { from, to } = calendarDayBounds(input.dayUtc, input.timeZone)
  const { startedAt, endedAt } = input
  const [context, saved] = await Promise.all([
    db.select().from(trackPoints).where(and(
      eq(trackPoints.userId, ownerId),
      eq(trackPoints.sessionId, input.sessionId),
      gte(trackPoints.tsUtc, new Date(Math.max(from.getTime(), startedAt - trackGeometryContextMs))),
      lte(trackPoints.tsUtc, new Date(Math.min(to.getTime() - 1, endedAt + trackGeometryContextMs))),
    )).orderBy(trackPoints.tsUtc),
    db.select({ id: trackActivityCorrections.id }).from(trackActivityCorrections).where(and(
      eq(trackActivityCorrections.userId, ownerId),
      eq(trackActivityCorrections.sessionId, input.sessionId),
      isNotNull(trackActivityCorrections.geometryAction),
      lte(trackActivityCorrections.startedAt, new Date(endedAt)),
      gte(trackActivityCorrections.endedAt, new Date(startedAt)),
    )).limit(1),
  ])

  if (saved.length) {
    return {
      action: null,
      reason: 'Для этого участка уже сохранена правка GPS.',
      affectedFixes: 0,
    }
  }

  const fixes = context.map(p => ({ ...p, tsUtc: p.tsUtc.getTime() }))
  const candidate = inspectTrackGeometry(fixes, startedAt, endedAt)

  if (candidate) {
    await quotaService.checkLlmCreditQuota(userId)
    const completion = await createAiChatRequest({
      system: `
Проверь предложенную правку GPS-трека по переданным замерам.
exclude-spike исключает одиночный или короткий выброс между двумя надёжными точками.
collapse-drift переносит неточные точки остановки к надёжной точке перед ней.
smooth-drift сглаживает боковое отклонение неточных точек по отрезку между более точными замерами.
Для smooth-drift движение ожидаемо. Знак lateralM показывает, с какой стороны от направления между опорными точками был замер.
Воздержись, если наблюдения указывают на реальный поворот, остановку при smooth-drift или если данных недостаточно.
Верни JSON с полями decision (suggest, keep или insufficient) и reason (понятное объяснение по-русски для пользователя, до 400 символов).
Не выдумывай места, события и измерения.
      `.trim(),
      user: JSON.stringify({ action: candidate.action, ...candidate.evidence }),
    }, {
      model: DEFAULT_AI_MODEL,
      temperature: 0,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    })

    await recordCompletionUsage(userId, completion)
    const result = parseDecision(completion.choices[0]?.message.content)
    return {
      action: result.decision === 'suggest' ? candidate.action : null,
      reason: result.reason,
      affectedFixes: result.decision === 'suggest' ? candidate.affected.length : 0,
    }
  }

  const aiContext = buildTrackIssueAiContext(fixes, startedAt, endedAt)
  if (!aiContext || aiContext.samples.length < 3) {
    return {
      action: null,
      reason: explainTrackGeometry(fixes, startedAt, endedAt),
      affectedFixes: 0,
    }
  }

  await quotaService.checkLlmCreditQuota(userId)
  const payloadSamples = aiContext.samples.map(({ source: _source, ...rest }) => rest)
  const completion = await createAiChatRequest({
    system: `
Ты анализируешь проблемный участок GPS-маршрута по относительным координатам в метрах (dxM — восток, dyM — север от первой точки окна), точности (accuracyM), скорости (speedKmh) и сигналу датчика телефона (deviceActivity).
Точки с inIssueWindow=true относятся к проверяемому проблемному участку, остальные — соседний контекст до и после него.
Твоя задача — нормализовать участок, если на нём есть явные GPS-выбросы (резкие отскоки в сторону/назад при плохой точности, ложные прыжки во время покоя) или сбой определения типа транспорта (например, activity="unknown" или противоречие между скоростью, траекторией, prevActivity/nextActivity и датчиком).
Правила:
1. Если внутри inIssueWindow=true есть конкретные выбивающиеся из траектории точки-выбросы (но при удалении всех точек не пропадёт весь реальный поворот маршрута), укажи их offset в массиве excludeOffsets и выбери decision="exclude_points" (или "both", если также нужно уточнить активность). Никогда не исключай точки с inIssueWindow=false.
2. Если на участке неверно определена или не распознана активность (activity="unknown" либо явный конфликт сигналов), укажи правильный тип в suggestedActivity (walk, bike, bus, vehicle, rail, moto, still) и decision="set_activity" (или "both").
3. Если точки идут последовательно и правдоподобно вдоль маршрута несмотря на сниженную точность, или данных слишком мало — верни decision="keep" или "insufficient".
Верни строго JSON: { "decision": "exclude_points" | "set_activity" | "both" | "keep" | "insufficient", "excludeOffsets": number[], "suggestedActivity": string | null, "reason": "краткое и понятное пользователю объяснение на русском (до 350 символов)" }.
Не выдумывай названия улиц или мест.
    `.trim(),
    user: JSON.stringify({
      durationSeconds: aiContext.durationSeconds,
      totalSpanM: aiContext.totalSpanM,
      prevActivity: aiContext.prevActivity,
      nextActivity: aiContext.nextActivity,
      samples: payloadSamples,
    }),
  }, {
    model: DEFAULT_AI_MODEL,
    temperature: 0,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  })

  await recordCompletionUsage(userId, completion)
  const complex = parseComplexDecision(completion.choices[0]?.message.content)

  const tsCounts = new Map<number, number>()
  for (const f of fixes)
    tsCounts.set(f.tsUtc, (tsCounts.get(f.tsUtc) ?? 0) + 1)

  const validExcludedTimestamps = (complex.decision === 'exclude_points' || complex.decision === 'both')
    ? Array.from(new Set(
        (complex.excludeOffsets ?? [])
          .map(offset => aiContext.samples.find(s => s.offset === offset && s.inIssueWindow)?.source.tsUtc)
          .filter((ts): ts is number => ts !== undefined && tsCounts.get(ts) === 1),
      )).sort((a, b) => a - b)
    : []

  const suggestedActivity = (complex.decision === 'set_activity' || complex.decision === 'both') && complex.suggestedActivity && complex.suggestedActivity !== 'unknown'
    ? complex.suggestedActivity
    : null

  if (validExcludedTimestamps.length > 0) {
    return {
      action: 'exclude-manual' as const,
      excludedTimestamps: validExcludedTimestamps,
      suggestedActivity,
      reason: complex.reason,
      affectedFixes: validExcludedTimestamps.length,
    }
  }

  if (suggestedActivity) {
    const issueCount = aiContext.samples.filter(s => s.inIssueWindow).length
    return {
      action: null,
      suggestedActivity,
      reason: complex.reason,
      affectedFixes: issueCount,
    }
  }

  return {
    action: null,
    reason: complex.reason,
    affectedFixes: 0,
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

function parseComplexDecision(content: string | null | undefined) {
  try {
    return ComplexIssueDecision.parse(JSON.parse(content ?? ''))
  }
  catch {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'ИИ не вернул корректный результат. Попробуйте ещё раз.' })
  }
}
