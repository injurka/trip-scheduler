import type { CityWeatherData } from '../../db/schema.type'
import { and, eq } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { db } from '../../db'
import { geoWeatherCache } from '../../db/schema'

export const geoWeatherCacheRepository = {
  async get(input: {
    placeId: string
    month: number
    generationVersion: string
    inputFingerprint: string
  }): Promise<CityWeatherData | null> {
    return measureDbQuery('geoWeatherCache', 'select', async () => {
      const cached = await db.query.geoWeatherCache.findFirst({
        where: and(
          eq(geoWeatherCache.placeId, input.placeId),
          eq(geoWeatherCache.month, input.month),
          eq(geoWeatherCache.generationVersion, input.generationVersion),
          eq(geoWeatherCache.inputFingerprint, input.inputFingerprint),
        ),
      })

      return cached?.data ?? null
    })
  },

  async save(input: {
    placeId: string
    month: number
    generationVersion: string
    inputFingerprint: string
    data: CityWeatherData
  }): Promise<void> {
    return measureDbQuery('geoWeatherCache', 'update', async () => {
      const now = new Date()
      await db.insert(geoWeatherCache)
        .values({
          placeId: input.placeId,
          month: input.month,
          generationVersion: input.generationVersion,
          inputFingerprint: input.inputFingerprint,
          data: input.data,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [geoWeatherCache.placeId, geoWeatherCache.month, geoWeatherCache.generationVersion],
          set: {
            inputFingerprint: input.inputFingerprint,
            data: input.data,
            updatedAt: now,
          },
        })
    })
  },
}
