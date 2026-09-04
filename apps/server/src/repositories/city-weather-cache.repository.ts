import type { CityWeatherData } from '../../db/schema.type'
import { and, eq, inArray } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { db } from '../../db'
import { cityWeatherCache } from '../../db/schema'

export const cityWeatherCacheRepository = {
  async getByCityAndMonth(cityNormalized: string, month: number): Promise<CityWeatherData | null> {
    return measureDbQuery('cityWeatherCache', 'select', async () => {
      const result = await db.query.cityWeatherCache.findFirst({
        where: and(
          eq(cityWeatherCache.cityNormalized, cityNormalized),
          eq(cityWeatherCache.month, month),
        ),
      })

      return result?.data ?? null
    })
  },

  async getManyByCitiesAndMonth(citiesNormalized: string[], month: number): Promise<Map<string, CityWeatherData>> {
    return measureDbQuery('cityWeatherCache', 'select', async () => {
      if (citiesNormalized.length === 0) {
        return new Map()
      }

      const results = await db.query.cityWeatherCache.findMany({
        where: and(
          inArray(cityWeatherCache.cityNormalized, citiesNormalized),
          eq(cityWeatherCache.month, month),
        ),
      })

      const map = new Map<string, CityWeatherData>()
      for (const row of results) {
        map.set(row.cityNormalized, row.data)
      }
      return map
    })
  },

  async save(cityNormalized: string, month: number, data: CityWeatherData): Promise<void> {
    return measureDbQuery('cityWeatherCache', 'update', async () => {
      const existing = await db.query.cityWeatherCache.findFirst({
        where: and(
          eq(cityWeatherCache.cityNormalized, cityNormalized),
          eq(cityWeatherCache.month, month),
        ),
        columns: { id: true },
      })

      if (existing) {
        await db
          .update(cityWeatherCache)
          .set({
            data,
            updatedAt: new Date(),
          })
          .where(eq(cityWeatherCache.id, existing.id))
      }
      else {
        await db.insert(cityWeatherCache).values({
          cityNormalized,
          month,
          data,
        })
      }
    })
  },

  async delete(cityNormalized: string, month: number): Promise<void> {
    return measureDbQuery('cityWeatherCache', 'delete', async () => {
      await db
        .delete(cityWeatherCache)
        .where(
          and(
            eq(cityWeatherCache.cityNormalized, cityNormalized),
            eq(cityWeatherCache.month, month),
          ),
        )
    })
  },
}
