/* eslint-disable no-console */

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const migrationClient = new Pool({
  connectionString: `${import.meta.env.DATABASE_URL}`,
  max: 1,
})

const db = drizzle(migrationClient)

const MAX_RETRIES = 30
const RETRY_DELAY_MS = 2000

async function waitForDatabase() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await migrationClient.query('SELECT 1')
      console.log('✅ Database is reachable.')
      return
    }
    catch {
      console.log(`Database is not ready yet (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
  throw new Error('Database is not reachable after multiple attempts')
}

async function runMigrations() {
  console.log('🏁 Starting migrations...')
  try {
    await waitForDatabase()
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✅ Migrations applied successfully!')
  }
  catch (error) {
    console.error('❌ Error applying migrations:', error)
    process.exit(1)
  }
  finally {
    await migrationClient.end()
    console.log('👋 Migration client disconnected.')
    process.exit(0)
  }
}

runMigrations()
