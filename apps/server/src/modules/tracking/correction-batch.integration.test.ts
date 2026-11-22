import { describe, expect, it } from 'bun:test'

describe.skipIf(!process.env.CORRECTION_BATCH_TEST_DATABASE_URL)('correction batch transaction', () => {
  it('preserves order, is retry-safe and rolls back the entire invalid packet', async () => {
    process.env.DATABASE_URL = process.env.CORRECTION_BATCH_TEST_DATABASE_URL!
    const { db, pool } = await import('../../../db')
    const { plans, users, trackPoints, trackActivityCorrections } = await import('../../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { saveCorrectionBatch } = await import('./correction-batch')
    const [plan] = await db.insert(plans).values({ name: crypto.randomUUID() }).returning()
    const [owner] = await db.insert(users).values({ planId: plan.id }).returning()
    const from = Date.parse('2026-11-12T10:00:00Z')
    const sessionId = crypto.randomUUID()
    try {
      await db.insert(trackPoints).values([0, 10000, 20000, 30000].map(t => ({ userId: owner.id, sessionId, clientPointId: crypto.randomUUID(), tsUtc: new Date(from + t), lat: 0, lng: 30 })))
      const first = { id: crypto.randomUUID(), sessionId, startedAt: from, endedAt: from + 30000, activity: 'vehicle' as const }
      const last = { ...first, id: crypto.randomUUID(), startedAt: from + 10000, endedAt: from + 20000, activity: 'bike' as const }
      const batch = { dayUtc: '2026-11-12', additions: [first, last], removals: [] }
      await saveCorrectionBatch(owner.id, batch)
      await saveCorrectionBatch(owner.id, batch)
      const { trackingService } = await import('./tracking.service')
      expect((await trackingService.getDay(owner.id, { dayUtc: '2026-11-12' })).points.map(p => p.activity)).toEqual(['vehicle', 'bike', 'bike', 'vehicle'])
      const rows = await db.select().from(trackActivityCorrections).where(eq(trackActivityCorrections.userId, owner.id)).orderBy(trackActivityCorrections.createdAt)
      expect(rows).toHaveLength(2)
      expect(rows.map(r => r.activity)).toEqual(['vehicle', 'bike'])
      expect(rows[1].createdAt.getTime()).toBeGreaterThan(rows[0].createdAt.getTime())
      await expect(saveCorrectionBatch(owner.id, { ...batch, additions: [{ ...first, id: crypto.randomUUID() }, { ...last, id: crypto.randomUUID(), sessionId: 'foreign-session' }], removals: [first.id] })).rejects.toThrow()
      expect(await db.select().from(trackActivityCorrections).where(eq(trackActivityCorrections.userId, owner.id))).toHaveLength(2)
      await expect(saveCorrectionBatch(owner.id, { ...batch, additions: [{ ...first, activity: 'rail' }] })).rejects.toThrow()
      await expect(saveCorrectionBatch(owner.id, { ...batch, additions: [{ ...first, id: crypto.randomUUID(), startedAt: from - 86400000 }] })).rejects.toThrow()
      await saveCorrectionBatch(owner.id, { ...batch, additions: [], removals: [first.id] })
      await saveCorrectionBatch(owner.id, { ...batch, additions: [], removals: [first.id] })
      expect(await db.select().from(trackActivityCorrections).where(eq(trackActivityCorrections.userId, owner.id))).toHaveLength(1)

      const dayInput = { dayUtc: batch.dayUtc, timeZone: 'UTC' }
      await saveCorrectionBatch(owner.id, { ...dayInput, additions: [], removals: [last.id] })
      for (const [firstActivity, lastActivity] of [['metro', 'ship'], ['plane', 'cable_car'], ['moto', 'ship'], ['bus', 'metro']] as const) {
        const early = { ...first, id: crypto.randomUUID(), endedAt: from + 15_000, activity: firstActivity }
        const late = { ...first, id: crypto.randomUUID(), startedAt: from + 15_000, activity: lastActivity }
        await saveCorrectionBatch(owner.id, { ...dayInput, additions: [early, late], removals: [] })
        const corrected = await trackingService.getDay(owner.id, dayInput)
        expect(corrected.segments.map(s => s.activity)).toEqual([firstActivity, lastActivity])
        expect(corrected.points.map(p => p.activity)).toEqual([firstActivity, firstActivity, lastActivity, lastActivity])
        expect(corrected.points.every(p => p.recordedActivity === 'unknown')).toBe(true)
        const { summary } = await trackingService.getDaySummary(owner.id, dayInput)
        expect(summary.byActivity.map(item => [item.activity, item.durationMs])).toEqual([[firstActivity, 15_000], [lastActivity, 15_000]])
        await saveCorrectionBatch(owner.id, { ...dayInput, additions: [], removals: [early.id, late.id] })
        expect((await trackingService.getDay(owner.id, dayInput)).segments.some(s => s.activity === firstActivity || s.activity === lastActivity)).toBe(false)
      }
    }
    finally {
      await db.delete(users).where(eq(users.id, owner.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  })
})
