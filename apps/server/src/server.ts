/* eslint-disable antfu/no-top-level-await */
import type { Hono } from 'hono'
import { db } from 'db'
import { sql } from 'drizzle-orm'
import Server from './app'
import { updateDatabaseMetrics } from './lib/db-monitoring'
import { Logger } from './lib/logger'
import { s3Service } from './services/s3.service'

const logger = new Logger()
const app: Hono = Server.getApp()
const port = Number(process.env.PORT) || 8080
const host = process.env.HOST || '0.0.0.0'

export async function checkService(name: string, fn: () => Promise<void>, logger: Logger): Promise<void> {
  logger.info(`Checking ${name}...`)
  const start = Date.now()
  await fn()
  logger.success(`${name} ready (${Date.now() - start}ms)`)
}

logger.log(`Trip Scheduler API starting on http://${host}:${port}`)

try {
  await checkService('PostgreSQL', () => db.execute(sql`SELECT 1`).then(() => { }), logger)
  await checkService('S3', () => s3Service.checkConnection(), logger)

  setInterval(updateDatabaseMetrics, 30_000)
  await updateDatabaseMetrics()

  logger.success('Server is ready 🚀')
}
catch (error) {
  logger.error('Startup failed — shutting down', error)
  process.exit(1)
}

export default { port, hostname: host, fetch: app.fetch }
