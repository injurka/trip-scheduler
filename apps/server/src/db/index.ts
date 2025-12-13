import Surreal from 'surrealdb'

// Экземпляр клиента
export const db = new Surreal()

let isConnected = false

export async function connectDB() {
  if (isConnected) {
    return
  }

  const url = process.env.SURREAL_URL || 'http://127.0.0.1:8000'
  const namespace = process.env.SURREAL_NS || 'trip_scheduler'
  const database = process.env.SURREAL_DB || 'dev'
  const username = process.env.SURREAL_USER || 'root'
  const password = process.env.SURREAL_PASS || 'root'

  try {
    await db.connect(`${url}/rpc`, {
      // Контекст для сессии (namespace и database)
      namespace,
      database,

      // Данные для аутентификации
      auth: {
        username, // Правильное имя свойства: 'username'
        password, // Правильное имя свойства: 'password'
      },
    })

    isConnected = true

    // eslint-disable-next-line no-console
    console.log(`✅ Connected and using SurrealDB at ${url} (${namespace}/${database})`)
  }
  catch (err) {
    console.error('❌ SurrealDB connect error:', err)
    process.exit(1)
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
