import { expect, it } from 'bun:test'

it.skipIf(!process.env.TRACKING_TEST_DATABASE_URL)(
  'isolates, renews and revokes native GPS credentials and locks the trip calendar on PostgreSQL',
  async () => {
    process.env.DATABASE_URL = process.env.TRACKING_TEST_DATABASE_URL!
    const { db, pool } = await import('../../../db')
    const { plans, users, trips, trackPoints, nativeTrackingKeys }
      = await import('../../../db/schema')
    const { eq } = await import('drizzle-orm')
    const {
      grantNativeTracking,
      authorizeNativeTracking,
      syncNativeTracking,
      revokeNativeTracking,
    } = await import('./native-sync')
    const { tripCalendarTimeZone } = await import('./trip-calendar')
    const [plan] = await db
      .insert(plans)
      .values({ name: `gps-native-${crypto.randomUUID()}` })
      .returning()
    const [owner, other] = await db
      .insert(users)
      .values([{ planId: plan.id }, { planId: plan.id }])
      .returning()
    const deviceId = crypto.randomUUID()
    const [trip] = await db
      .insert(trips)
      .values({
        id: crypto.randomUUID(),
        title: 'GPS test',
        userId: owner.id,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
      })
      .returning()
    try {
      const credential = await grantNativeTracking(owner.id, deviceId)
      expect(
        await authorizeNativeTracking(credential.syncToken, owner.id),
      ).toBe(owner.id)
      await expect(
        authorizeNativeTracking(credential.syncToken, other.id),
      ).rejects.toThrow('Войдите')
      const point = {
        clientPointId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        tsUtc: Date.parse('2026-11-17T07:30:00+08:00'),
        lat: 25,
        lng: 121,
        activity: 'unknown' as const,
        activityConfidence: 0,
        deviceActivity: 'walk' as const,
        deviceActivityConfidence: 90,
        samplingIntervalMs: 3000,
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(
          (
            await syncNativeTracking({
              ownerId: owner.id,
              syncToken: credential.syncToken,
              points: [point],
            })
          ).accepted,
        ).toEqual([point.clientPointId])
      }
      expect(
        (
          await db
            .select()
            .from(trackPoints)
            .where(eq(trackPoints.userId, owner.id))
        ).length,
      ).toBe(1)
      expect(
        (
          await db
            .select()
            .from(trackPoints)
            .where(eq(trackPoints.userId, other.id))
        ).length,
      ).toBe(0)
      expect(await tripCalendarTimeZone(trip)).toBe('Asia/Taipei')
      await db
        .update(trackPoints)
        .set({ lat: 35.67, lng: 139.65 })
        .where(eq(trackPoints.userId, owner.id))
      expect(await tripCalendarTimeZone(trip)).toBe('Asia/Taipei')
      const [locked] = await db
        .select()
        .from(trips)
        .where(eq(trips.id, trip.id))
      expect(locked.timeZone).toBe('Asia/Taipei')
      await db
        .update(nativeTrackingKeys)
        .set({ expiresAt: new Date(Date.now() - 1) })
        .where(eq(nativeTrackingKeys.userId, owner.id))
      await expect(
        authorizeNativeTracking(credential.syncToken, owner.id),
      ).rejects.toThrow('Войдите')
      const fresh = await grantNativeTracking(owner.id, deviceId)
      await expect(
        authorizeNativeTracking(credential.syncToken, owner.id),
      ).rejects.toThrow('Войдите')
      expect(await authorizeNativeTracking(fresh.syncToken, owner.id)).toBe(
        owner.id,
      )
      await revokeNativeTracking(owner.id)
      await expect(
        authorizeNativeTracking(fresh.syncToken, owner.id),
      ).rejects.toThrow('Войдите')
    }
    finally {
      await db.delete(users).where(eq(users.id, owner.id))
      await db.delete(users).where(eq(users.id, other.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  },
)
