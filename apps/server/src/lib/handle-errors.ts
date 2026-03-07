import { uncaughtExceptionsCounter } from '~/services/metrics.service'

export function setupHandleServerErrors() {
  process.on('uncaughtException', (err, origin) => {
    console.error(`[Uncaught Exception] Origin: ${origin}, Error:`, err)
    uncaughtExceptionsCounter.inc()
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection] At:', promise, 'reason:', reason)
    uncaughtExceptionsCounter.inc()
  })
}
