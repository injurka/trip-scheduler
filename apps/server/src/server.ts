/* eslint-disable antfu/no-top-level-await */
/* eslint-disable no-console */
import type { Hono } from 'hono'
import Server from './app'
import { connectDB } from './db'
import { updateDatabaseMetrics } from './lib/db-monitoring'
import { uncaughtExceptionsCounter } from './services/metrics.service'

const app: Hono = Server.getApp()
const port = Number(process.env.PORT) || 8080
const host = process.env.HOST || '0.0.0.0'

console.log(`🚀 Trip Scheduler API starting...`)
console.log(`📍 Server running at http://${host}:${port}`)

process.on('uncaughtException', (err, origin) => {
  console.error(`[Uncaught Exception] Origin: ${origin}, Error:`, err)
  uncaughtExceptionsCounter.inc()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] At:', promise, 'reason:', reason)
  uncaughtExceptionsCounter.inc()
})

// Инициализация
try {
  console.log('🟡 Connecting to SurrealDB...')
  await connectDB()

  setInterval(updateDatabaseMetrics, 30000)
  await updateDatabaseMetrics()
}
catch (error) {
  console.error('❌ Fatal Error: Could not connect to database.', error)
  process.exit(1)
}

export default {
  port,
  hostname: host,
  fetch: app.fetch,
}
