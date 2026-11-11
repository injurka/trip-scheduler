import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { activities, days, memories, trackActivityCorrections, trackPoints, tripGeoPlaces, tripImages, tripNotes, trips } from 'db/schema'
import { and, eq, gt, gte, lt, sql } from 'drizzle-orm'
import { summarizeTripTrack } from './trip-statistics.compute'
import { TripStatisticsSchema } from './trip-statistics.schema'

export const tripStatisticsService = {
  async get(tripId: string) {
    const [row] = await db.select({ statistics: trips.statistics }).from(trips).where(eq(trips.id, tripId))
    const parsed = TripStatisticsSchema.safeParse(row?.statistics)
    return parsed.success ? parsed.data : null
  },

  async refresh(tripId: string) {
    return db.transaction(async (tx) => {
      const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${`trip-statistics:${tripId}`})) as locked`)
      if (!lock.rows[0]?.locked)
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Статистика уже обновляется. Попробуйте чуть позже.' })
      const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId))
      if (!trip)
        throw new TRPCError({ code: 'NOT_FOUND' })
      const cached = TripStatisticsSchema.safeParse(trip.statistics)
      if (cached.success && Date.now() - Date.parse(cached.data.computedAt) < 60_000)
        return cached.data
      const from = new Date(`${trip.startDate}T00:00:00Z`)
      const to = new Date(Date.parse(`${trip.endDate}T00:00:00Z`) + 86400000)
      const [media] = await tx.select({
        photos: sql<number>`count(distinct ${tripImages.id}) filter (where ${tripImages.mediaType} = 'image')::int`,
        videos: sql<number>`count(distinct ${tripImages.id}) filter (where ${tripImages.mediaType} = 'video')::int`,
        favoritePhotos: sql<number>`count(distinct ${tripImages.id}) filter (where ${tripImages.mediaType} = 'image' and ${memories.rating} >= 4)::int`,
        textMemories: sql<number>`count(*) filter (where ${memories.imageId} is null)::int`,
      }).from(memories).leftJoin(tripImages, eq(memories.imageId, tripImages.id)).where(eq(memories.tripId, tripId))
      const [notes] = await tx.select({ count: sql<number>`count(*)::int` }).from(tripNotes).where(and(eq(tripNotes.tripId, tripId), sql`${tripNotes.type} != 'folder'`))
      const [documents] = await tx.select({ count: sql<number>`count(*)::int` }).from(tripImages).where(and(eq(tripImages.tripId, tripId), eq(tripImages.placement, 'documents')))
      const [planned] = await tx.select({ count: sql<number>`count(*)::int` }).from(activities).innerJoin(days, eq(activities.dayId, days.id)).where(eq(days.tripId, tripId))
      const [places] = await tx.select({ count: sql<number>`count(distinct ${tripGeoPlaces.placeId})::int` }).from(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, tripId))
      // Same owner and UTC date range as the public trip day player; never sum participant tracks twice.
      const points = await tx.select().from(trackPoints).where(and(eq(trackPoints.userId, trip.userId), gte(trackPoints.tsUtc, from), lt(trackPoints.tsUtc, to))).orderBy(trackPoints.tsUtc)
      const corrections = await tx.select().from(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, trip.userId), lt(trackActivityCorrections.startedAt, to), gt(trackActivityCorrections.endedAt, from))).orderBy(trackActivityCorrections.createdAt, trackActivityCorrections.id)
      const tracking = summarizeTripTrack(points.map(p => ({ ...p, tsUtc: p.tsUtc.getTime() })), corrections.map(c => ({ ...c, startedAt: c.startedAt.getTime(), endedAt: c.endedAt.getTime(), createdAt: c.createdAt.getTime() })))
      const result = TripStatisticsSchema.parse({ version: 1, computedAt: new Date().toISOString(), startDate: trip.startDate, endDate: trip.endDate, ...media, notes: notes.count, documents: documents.count, plannedActivities: planned.count, plannedPlaces: places.count, ...tracking })
      await tx.update(trips).set({ statistics: result }).where(eq(trips.id, tripId))
      return result
    }, { isolationLevel: 'repeatable read' })
  },
}
