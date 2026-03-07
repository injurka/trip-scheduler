import type { Logger } from './logger'
import { gte, sql } from 'drizzle-orm'
import { activeSessionsGauge, dbActiveQueriesGauge, dbQueryDurationHistogram, totalTripsGauge, totalUsersGauge } from '~/services/metrics.service'
import { s3Service } from '~/services/s3.service'
import { db } from '../../db'
import { refreshTokens, trips, users } from '../../db/schema'

/**
 * Обертка для измерения длительности выполнения запроса к базе данных.
 * @param table - Название таблицы (для метки).
 * @param operation - Тип операции (select, insert, update, delete).
 * @param queryFn - Асинхронная функция, выполняющая запрос к БД.
 * @returns Результат выполнения queryFn.
 */
export async function measureDbQuery<T>(
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete' | 'transaction',
  queryFn: () => Promise<T>,
): Promise<T> {
  dbActiveQueriesGauge.inc()
  const end = dbQueryDurationHistogram.startTimer({ table, operation })
  try {
    const result = await queryFn()
    return result
  }
  finally {
    end()
    dbActiveQueriesGauge.dec()
  }
}

/**
 * Асинхронная функция для обновления метрик, основанных на данных из БД.
 */
export async function updateDatabaseMetrics() {
  try {
    const [userCountResult] = await db.select({ count: sql<number>`count(*)` }).from(users)
    totalUsersGauge.set(Number(userCountResult.count))

    const [tripCountResult] = await db.select({ count: sql<number>`count(*)` }).from(trips)
    totalTripsGauge.set(Number(tripCountResult.count))

    const [activeTokensResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(refreshTokens)
      .where(gte(refreshTokens.expiresAt, new Date()))

    activeSessionsGauge.set(Number(activeTokensResult.count))
  }
  catch (error) {
    console.error('❌ Ошибка при обновлении метрик из базы данных:', error)
  }
}
