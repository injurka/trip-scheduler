import type { CityWeatherData } from '../../db/schema.type'
import { and, eq, inArray } from 'drizzle-orm'
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

  async getMany(items: Array<{
    placeId: string
    month: number
    generationVersion: string
    inputFingerprint: string
  }>): Promise<Map<string, CityWeatherData>> {
    const resultMap = new Map<string, CityWeatherData>()
    if (items.length === 0)
      return resultMap

    return measureDbQuery('geoWeatherCache', 'select', async () => {
      const placeIds = [...new Set(items.map(item => item.placeId))]
      const itemMap = new Map(
        items.map(item => [`${item.placeId}:${item.month}:${item.generationVersion}:${item.inputFingerprint}`, item.placeId]),
      )

      const records = await db.query.geoWeatherCache.findMany({
        where: inArray(geoWeatherCache.placeId, placeIds),
      })

      for (const record of records) {
        const key = `${record.placeId}:${record.month}:${record.generationVersion}:${record.inputFingerprint}`
        if (itemMap.has(key)) {
          resultMap.set(record.placeId, record.data)
        }
      }

      return resultMap
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
