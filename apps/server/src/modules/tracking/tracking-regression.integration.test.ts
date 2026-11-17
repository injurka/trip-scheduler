import { expect, it, spyOn } from 'bun:test'

it.skipIf(!process.env.TRACKING_TEST_DATABASE_URL)('preserves local days, midnight corrections and account ownership on PostgreSQL', async () => {
  process.env.DATABASE_URL = process.env.TRACKING_TEST_DATABASE_URL!
  const { db, pool } = await import('../../../db')
  const { plans, users, trackPoints } = await import('../../../db/schema')
  const { eq } = await import('drizzle-orm')
  const { trackingService } = await import('./tracking.service')
  const { saveCorrectionBatch } = await import('./correction-batch')
  const [plan] = await db.insert(plans).values({ name: `tracking-regression-${crypto.randomUUID()}` }).returning()
  const [user] = await db.insert(users).values({ planId: plan.id }).returning()
  const midnight = Date.parse('2026-11-17T00:00:00+08:00')
  const utcMidnight = Date.parse('2026-11-17T00:00:00Z')
  const early = Date.parse('2026-11-17T07:30:00+08:00')
  const sessionId = crypto.randomUUID()
  const now = spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-17T12:00Z'))
  try {
    await db.insert(trackPoints).values([midnight - 1, midnight, early, utcMidnight, midnight + 86400000].map(ts => ({ userId: user.id, clientPointId: crypto.randomUUID(), sessionId, tsUtc: new Date(ts), lat: 25, lng: 121, activity: 'walk' as const, accuracy: 5, speed: 1 })))
    const additions = [midnight, utcMidnight].map(startedAt => ({ id: crypto.randomUUID(), sessionId, startedAt, endedAt: startedAt, activity: 'rail' as const, point: true }))
    await saveCorrectionBatch(user.id, { dayUtc: '2026-11-17', timeZone: 'Asia/Taipei', additions, removals: [] })
    const day = await trackingService.getDay(user.id, { dayUtc: '2026-11-17', timeZone: 'Asia/Taipei' })
    expect(day.points.map(p => p.tsUtc)).toEqual([midnight, early, utcMidnight])
    expect(day.corrections.map(c => c.id)).toEqual(additions.map(c => c.id))
    expect(day.points.filter(p => p.activitySource === 'manual').map(p => p.tsUtc)).toEqual([midnight, utcMidnight])
    const inferred = await trackingService.getDay(user.id, { dayUtc: '2026-11-17' })
    expect(inferred.timeZone).toBe('Asia/Taipei')
    expect(inferred.points.map(p => p.tsUtc)).toEqual(day.points.map(p => p.tsUtc))
    const utc = await trackingService.getDay(user.id, { dayUtc: '2026-11-17', timeZone: 'UTC' })
    expect(utc.corrections.some(c => c.startedAt === utcMidnight)).toBe(true)
    const yesterday = await trackingService.getDay(user.id, { dayUtc: '2026-11-16', timeZone: 'Asia/Taipei' })
    expect(yesterday.points.map(p => p.tsUtc)).toEqual([midnight - 1])
    const summaries = await trackingService.getSummaries(user.id, 2, 'Asia/Taipei')
    expect(summaries.find(s => s.dayUtc === '2026-11-17')?.firstPointTs).toBe(midnight)
    expect(summaries.find(s => s.dayUtc === '2026-11-17')?.lastPointTs).toBe(utcMidnight)
    await expect(trackingService.ingestBatch(user.id, { ownerId: crypto.randomUUID(), points: [{ clientPointId: crypto.randomUUID(), sessionId, tsUtc: early, lat: 25, lng: 121, activity: 'walk', activityConfidence: 90 }] })).rejects.toThrow('другому аккаунту')
    await expect(saveCorrectionBatch(user.id, { dayUtc: '2026-11-17', timeZone: 'Asia/Taipei', additions: [{ ...additions[0], id: crypto.randomUUID(), startedAt: midnight - 1, endedAt: midnight - 1 }], removals: [] })).rejects.toThrow('выбранному дню')
  }
  finally {
    now.mockRestore()
    await db.delete(users).where(eq(users.id, user.id))
    await db.delete(plans).where(eq(plans.id, plan.id))
    await pool.end()
  }
})
