import { describe, expect, it } from 'bun:test'

describe.skipIf(!process.env.TRIP_STATISTICS_TEST_DATABASE_URL)('trip statistics database snapshot', () => {
  it('persists aggregates, deduplicates media, caches reads and protects refresh frequency', async () => {
    process.env.DATABASE_URL = process.env.TRIP_STATISTICS_TEST_DATABASE_URL!
    const { db, pool } = await import('../../../db')
    const { plans, users, trips, memories, tripImages, tripNotes } = await import('../../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { tripStatisticsService } = await import('./trip-statistics.service')
    const { tripTrackAccess, editableTripTrack } = await import('../tracking/trip-track-access')
    const [plan] = await db.insert(plans).values({ name: crypto.randomUUID() }).returning()
    const [owner] = await db.insert(users).values({ planId: plan.id }).returning()
    const tripId = crypto.randomUUID()
    await db.insert(trips).values({ id: tripId, userId: owner.id, title: 'Statistics', startDate: '2026-11-11', endDate: '2026-11-12', shareSlug: `stats-${tripId}` })
    try {
      expect(await tripStatisticsService.get(tripId)).toBeNull()
      await expect(tripTrackAccess(tripId)).rejects.toThrow()
      expect((await tripTrackAccess(tripId, null, `stats-${tripId}`)).canEdit).toBe(false)
      await expect(editableTripTrack(tripId, { id: crypto.randomUUID(), role: 'user' })).rejects.toThrow()
      const [image] = await db.insert(tripImages).values({ tripId, originalName: 'photo.jpg', url: 'test/photo.jpg', placement: 'memories' }).returning()
      await db.insert(memories).values([{ tripId, imageId: image.id, rating: 5 }, { tripId, imageId: image.id }, { tripId, comment: 'Story' }])
      await db.insert(tripNotes).values([{ tripId, type: 'folder', title: 'Folder' }, { tripId, type: 'markdown', title: 'Note' }])
      const first = await tripStatisticsService.refresh(tripId)
      expect(first.photos).toBe(1)
      expect(first.favoritePhotos).toBe(1)
      expect(first.textMemories).toBe(1)
      expect(first.notes).toBe(1)
      expect(first.trackedDays).toBe(0)
      await db.insert(memories).values({ tripId, comment: 'More' })
      expect(await tripStatisticsService.get(tripId)).toEqual(first)
      expect(await tripStatisticsService.refresh(tripId)).toEqual(first)
      await db.update(trips).set({ statistics: { ...first, computedAt: new Date(Date.now() - 120000).toISOString() } }).where(eq(trips.id, tripId))
      expect((await tripStatisticsService.refresh(tripId)).textMemories).toBe(2)
    }
    finally {
      await db.delete(users).where(eq(users.id, owner.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  })
})
