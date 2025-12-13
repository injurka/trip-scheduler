import { db } from '~/db'
import { activeSessionsGauge, dbActiveQueriesGauge, dbQueryDurationHistogram, totalTripsGauge, totalUsersGauge } from '~/services/metrics.service'

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

export async function updateDatabaseMetrics() {
  try {
    const [userRes] = await db.query<[{ count: number }][]>('SELECT count() FROM user GROUP ALL')
    totalUsersGauge.set(userRes[0]?.count || 0)

    const [tripRes] = await db.query<[{ count: number }][]>('SELECT count() FROM trip GROUP ALL')
    totalTripsGauge.set(tripRes[0]?.count || 0)

    const [tokenRes] = await db.query<[{ count: number }][]>('SELECT count() FROM refresh_token WHERE expiresAt > time::now() GROUP ALL')
    activeSessionsGauge.set(tokenRes[0]?.count || 0)
  }
  catch (error) {
    console.error('❌ Error updating metrics:', error)
  }
}
