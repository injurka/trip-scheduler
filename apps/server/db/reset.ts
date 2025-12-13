/* eslint-disable no-console */
import { connectDB, db } from '../src/db'

async function reset() {
  console.log('⏳ Сброс базы данных...')
  await connectDB()

  const [info] = await db.query<[{ tables: Record<string, string> }]>('INFO FOR DB')

  const tables = Object.keys(info.tables || {})

  if (tables.length === 0) {
    console.log('✅ База данных уже пуста')
    process.exit(0)
  }

  const query = tables.map(t => `REMOVE TABLE \`${t}\``).join(';')

  console.log(`🗑️  Удаление таблиц: ${tables.join(', ')}...`)
  await db.query(query)

  console.log('✅ База данных успешно очищена')
  process.exit(0)
}

reset().catch((err) => {
  console.error('❌ Ошибка при сбросе базы:', err)
  process.exit(1)
})
