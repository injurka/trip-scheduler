import { Surreal } from 'surrealdb'

// Создаем единственный экземпляр клиента
export const db = new Surreal()

export async function connectDB() {
  try {
    // Читаем конфигурацию из переменных окружения
    const dbUrl = import.meta.env.SURREAL_URL || 'http://127.0.0.1:8000/rpc'
    const dbNs = import.meta.env.SURREAL_NS || 'trip_scheduler'
    const dbName = import.meta.env.SURREAL_DB || 'dev'
    const dbUser = import.meta.env.SURREAL_USER
    const dbPass = import.meta.env.SURREAL_PASS

    // Подключаемся к базе данных
    await db.connect(dbUrl)

    // Выбираем namespace и database
    await db.use({ namespace: dbNs, database: dbName })

    // Если заданы учетные данные, аутентифицируемся
    if (dbUser && dbPass) {
      await db.signin({
        username: dbUser,
        password: dbPass,
      })
    }

    // eslint-disable-next-line no-console
    console.log(`✅ Connected and using SurrealDB at ${dbUrl} (${dbNs}/${dbName})`)
  }
  catch (err) {
    console.error('❌ Ошибка подключения к SurrealDB:', err)
    throw err // Пробрасываем ошибку дальше
  }
}

/**
 * Хелпер для приведения ID к формату SurrealDB (table:uuid).
 * Если ID уже содержит двоеточие, возвращает как есть.
 */
export function toId(table: string, id: string): string {
  if (!id) {
    return ''
  }
  return id.includes(':') ? id : `${table}:${id}`
}

/**
 * Хелпер для извлечения "чистого" ID (без префикса таблицы),
 * если это необходимо для легаси-логики (хотя лучше использовать полные ID).
 */
export function fromId(id: string): string {
  if (!id) {
    return ''
  }
  const parts = id.split(':')
  return parts.length > 1 ? parts[1] : id
}
