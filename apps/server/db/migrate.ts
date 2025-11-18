/* eslint-disable no-console */

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const migrationClient = new Pool({
  connectionString: `${import.meta.env.DATABASE_URL}`,
  max: 1,
})

const db = drizzle(migrationClient)

async function runMigrations() {
  console.log('🏁 Starting migrations...')
  try {
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
