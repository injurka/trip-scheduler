import { dbActiveQueriesGauge, dbQueryDurationHistogram } from '~/services/metrics.service'

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
