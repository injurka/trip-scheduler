import { describe, expect, it } from 'bun:test'

describe.skipIf(!process.env.CORRECTION_BATCH_TEST_DATABASE_URL)('AI track geometry corrections', () => {
  it('uses relative evidence, only persists on confirmation, and restores the original on undo', async () => {
    process.env.DATABASE_URL = process.env.CORRECTION_BATCH_TEST_DATABASE_URL!
    const { db, pool } = await import('../../../db')
    const { llmModels, llmTokenUsage, plans, trackPoints, users } = await import('../../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { DEFAULT_AI_MODEL } = await import('~/lib/llm')
    const { analyzeTrackQuality } = await import('./track-quality-analysis')
    const { saveCorrectionBatch } = await import('./correction-batch')
    const { trackingService } = await import('./tracking.service')
    const [plan] = await db.insert(plans).values({ name: crypto.randomUUID(), monthlyLlmCredits: 1000 }).returning()
    const [owner] = await db.insert(users).values({ planId: plan.id }).returning()
    await db.insert(llmModels).values({ id: DEFAULT_AI_MODEL, costPerMillionInputTokens: 1 }).onConflictDoNothing()

    let requests = 0
    let payload = ''
    let decision = '{"decision":"suggest","reason":"Одиночный скачок между двумя точными замерами."}'
    const provider = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        requests++
        payload = await request.text()
        return Response.json({
          model: DEFAULT_AI_MODEL,
          choices: [{ message: { content: decision } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        })
      },
    })
    const apiUrl = process.env.AI_HUBMIX_API_URL
    const apiKey = process.env.AI_HUBMIX_KEY
    process.env.AI_HUBMIX_API_URL = provider.url.href
    process.env.AI_HUBMIX_KEY = 'test-key'
    const from = Date.parse('2026-11-12T10:00:00Z')
    const sessionId = crypto.randomUUID()
    const fixes = [30, 30.0014, 30.00004].map((lng, index) => ({
      userId: owner.id,
      sessionId,
      clientPointId: crypto.randomUUID(),
      tsUtc: new Date(from + index * 5000),
      lat: 0,
      lng,
      accuracy: index === 1 ? 60 : 8,
    }))
    const input = { dayUtc: '2026-11-12', timeZone: 'UTC', sessionId, startedAt: from + 5000, endedAt: from + 10000 }
    try {
      await db.insert(trackPoints).values(fixes)
      const getDay = () => trackingService.getDay(owner.id, input)
      expect((await analyzeTrackQuality(owner.id, crypto.randomUUID(), input)).action).toBeNull()
      expect(requests).toBe(0)
      expect(await analyzeTrackQuality(owner.id, owner.id, input)).toMatchObject({ action: 'exclude-spike', affectedFixes: 1 })
      expect(requests).toBe(1)
      expect(payload).not.toContain(sessionId)
      expect(payload).not.toContain('30.0014')
      expect(payload).not.toContain(String(from))
      expect(await db.select().from(llmTokenUsage).where(eq(llmTokenUsage.userId, owner.id))).toHaveLength(1)
      expect((await getDay()).points).toHaveLength(3)

      decision = '{"decision":"keep","reason":"Недостаточно признаков выброса."}'
      expect((await analyzeTrackQuality(owner.id, owner.id, input)).action).toBeNull()
      decision = '{"decision":"invent","reason":"Заменить координаты."}'
      await expect(analyzeTrackQuality(owner.id, owner.id, input)).rejects.toThrow('ИИ не вернул корректный результат')

      const correction = { id: crypto.randomUUID(), sessionId, startedAt: input.startedAt, endedAt: input.endedAt, activity: 'unknown' as const, geometryAction: 'exclude-spike' as const }
      await expect(saveCorrectionBatch(owner.id, { ...input, additions: [{ ...correction, geometryAction: 'collapse-drift' }], removals: [] })).rejects.toThrow()
      await saveCorrectionBatch(owner.id, { ...input, additions: [correction], removals: [] })
      const corrected = await getDay()
      expect(corrected.points.map(p => p.clientPointId)).toEqual([fixes[0].clientPointId, fixes[2].clientPointId])
      expect(corrected.rawPoints?.map(p => p.lng)).toEqual(fixes.map(p => p.lng))
      expect((await analyzeTrackQuality(owner.id, owner.id, input)).action).toBeNull()
      expect(requests).toBe(3)

      await saveCorrectionBatch(owner.id, { ...input, additions: [], removals: [correction.id] })
      expect((await getDay()).points.map(p => p.lng)).toEqual(fixes.map(p => p.lng))
    }
    finally {
      await provider.stop(true)
      if (apiUrl === undefined)
        delete process.env.AI_HUBMIX_API_URL
      else
        process.env.AI_HUBMIX_API_URL = apiUrl
      if (apiKey === undefined)
        delete process.env.AI_HUBMIX_KEY
      else
        process.env.AI_HUBMIX_KEY = apiKey
      await db.delete(users).where(eq(users.id, owner.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  })
})
