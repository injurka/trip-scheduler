/* eslint-disable antfu/no-top-level-await */
import type { Hono } from 'hono'
import path from 'node:path'
import { db } from 'db'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import cron from 'node-cron'
import Server from './app'
import { updateDatabaseMetrics } from './lib/db-monitoring'
import { Logger } from './lib/logger'
import { dumpService } from './services/dump.service'
import { s3Service } from './services/s3.service'
import { processStorageCleanup } from './services/storage-cleanup.service'

const logger = new Logger()
const app: Hono = Server.getApp()
const port = Number(process.env.PORT) || 8080
const host = process.env.HOST || '0.0.0.0'
const dumpEnabled = (process.env.DUMP_ENABLED ?? 'true') === 'true'

export async function checkService(name: string, fn: () => Promise<void>, logger: Logger): Promise<void> {
  logger.info(`Checking ${name}...`)
  const start = Date.now()
  await fn()
  logger.success(`${name} ready (${Date.now() - start}ms)`)
}

async function createDump(info: string) {
  logger.info(`⏰ ${info}`)

  try {
    await dumpService.generateAndUploadDump('s3')
  }
  catch (err) {
    logger.error('Сбой при выполнении крона для дампа', err)
  }
}

async function waitForPostgres() {
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checkService('PostgreSQL', () => db.execute(sql`SELECT 1`).then(() => { }), logger)
      return
    }
    catch (error) {
      if (attempt === maxAttempts)
        throw error

      logger.warn(`PostgreSQL ещё не готова (попытка ${attempt}/${maxAttempts}); повтор через 5 секунд`, error)
      await Bun.sleep(5_000)
    }
  }
}

logger.log(`Trip Scheduler API starting on http://${host}:${port}`)

try {
  await waitForPostgres()

  logger.info('Применение миграций базы данных...')
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  logger.success('Миграции успешно применены!')

  await checkService('S3', () => s3Service.checkConnection(), logger)

  setInterval(updateDatabaseMetrics, 30_000)
  await updateDatabaseMetrics()

  if (dumpEnabled) {
    createDump('Запуск дампа базы данных...')
    cron.schedule('0 3 * * 0', async () => {
      createDump('Запуск еженедельного дампа базы данных по расписанию...')
    })
  }

  void processStorageCleanup()
  setInterval(() => void processStorageCleanup(), 30_000)

  logger.success('Server is ready 🚀')
}
catch (error) {
  logger.error('Startup failed — shutting down', error)
  process.exit(1)
}

export default { port, hostname: host, fetch: app.fetch, idleTimeout: 120 }
