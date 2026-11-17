import { isTimeZone } from '@limiteddissolve/track-processing'
import { db } from 'db'
import { geoPlaces, trackPoints, tripGeoPlaces, trips } from 'db/schema'
import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm'
import tzLookup from 'tz-lookup'
import { measureDbQuery } from '~/lib/db-monitoring'

/** Lock a trip's calendar to its first planned place (or first recording), once. */
export async function tripCalendarTimeZone(trip: {
  id: string
  userId: string
  startDate: string
  endDate: string
  timeZone?: string | null
}): Promise<string> {
  if (trip.timeZone && isTimeZone(trip.timeZone))
    return trip.timeZone
  const [place] = await measureDbQuery('trip_geo_places', 'select', () =>
    db
      .select({
        timeZone: geoPlaces.timezone,
        lat: geoPlaces.latitude,
        lng: geoPlaces.longitude,
      })
      .from(tripGeoPlaces)
      .innerJoin(geoPlaces, eq(tripGeoPlaces.placeId, geoPlaces.id))
      .where(eq(tripGeoPlaces.tripId, trip.id))
      .orderBy(asc(tripGeoPlaces.position))
      .limit(1))
  let zone
    = place?.timeZone && isTimeZone(place.timeZone)
      ? place.timeZone
      : place
        ? tzLookup(place.lat, place.lng)
        : undefined
  if (!zone) {
    const from = Date.parse(`${trip.startDate}T00:00:00Z`) - 14 * 3600_000
    const until = Date.parse(`${trip.endDate}T00:00:00Z`) + 38 * 3600_000
    const [point] = await measureDbQuery('track_points', 'select', () =>
      db
        .select({ lat: trackPoints.lat, lng: trackPoints.lng })
        .from(trackPoints)
        .where(
          and(
            eq(trackPoints.userId, trip.userId),
            gte(trackPoints.tsUtc, new Date(from)),
            lt(trackPoints.tsUtc, new Date(until)),
          ),
        )
        .orderBy(asc(trackPoints.tsUtc))
        .limit(1))
    if (point)
      zone = tzLookup(point.lat, point.lng)
  }
  // An empty future trip must not be permanently bound to a guessed UTC calendar.
  if (!zone)
    return 'UTC'
  await measureDbQuery('trips', 'update', () =>
    db
      .update(trips)
      .set({ timeZone: zone })
      .where(and(eq(trips.id, trip.id), isNull(trips.timeZone))))
  const [stored] = await measureDbQuery('trips', 'select', () =>
    db
      .select({ timeZone: trips.timeZone })
      .from(trips)
      .where(eq(trips.id, trip.id))
      .limit(1))
  return stored?.timeZone ?? zone
}
