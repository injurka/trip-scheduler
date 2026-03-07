/* eslint-disable no-console */
import { sql } from 'drizzle-orm'
import { db } from './index'

async function reset() {
  console.log('⏳ Сброс базы данных...')
  await db.execute(sql`DROP SCHEMA public CASCADE`)
  await db.execute(sql`CREATE SCHEMA public`)
  await db.execute(sql`GRANT ALL ON SCHEMA public TO public`)
  console.log('✅ База данных очищена')
  process.exit(0)
}

reset().catch((err) => {
  console.error(err)
  process.exit(1)
})
