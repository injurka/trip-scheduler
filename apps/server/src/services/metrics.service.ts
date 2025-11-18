import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client'

// Включаем сбор стандартных метрик (CPU, память и т.д.)
register.setDefaultLabels({
  app: 'trip-scheduler-server',
})

// Собирает event loop lag, gc stats, heap usage и т.д.
collectDefaultMetrics()

// 1. Счетчик HTTP-запросов
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
})

// 2. Гистограмма длительности HTTP-запросов
export const httpRequestDurationHistogram = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5],
})

// 3. Счетчик tRPC процедур
export const trpcRequestCounter = new Counter({
  name: 'trpc_requests_total',
  help: 'Total number of tRPC requests',
  labelNames: ['path', 'type', 'status'],
})

// 4. Гистограмма длительности tRPC процедур
export const trpcRequestDurationHistogram = new Histogram({
  name: 'trpc_request_duration_seconds',
  help: 'Duration of tRPC requests in seconds',
  labelNames: ['path', 'type', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
})

// 5. Gauge для количества пользователей
export const totalUsersGauge = new Gauge({
  name: 'total_registered_users',
  help: 'Total number of registered users in the database',
})

// 6. Gauge для количества путешествий
export const totalTripsGauge = new Gauge({
  name: 'total_trips_in_database',
  help: 'Total number of trips in the database',
})

// 7. Gauge для активных сессий
export const activeSessionsGauge = new Gauge({
  name: 'active_user_sessions',
  help: 'Number of active user sessions based on valid refresh tokens',
})

// 8. Счетчик загрузок файлов
export const fileUploadsCounter = new Counter({
  name: 'file_uploads_total',
  help: 'Total number of uploaded files',
  labelNames: ['placement'],
})

// 9. Гистограмма размеров загруженных файлов
export const fileUploadSizeBytesHistogram = new Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size distribution of uploaded files in bytes',
  labelNames: ['placement'],
  buckets: [100000, 500000, 1000000, 5000000, 10000000, 25000000],
})

// 10. Счетчик необработанных исключений
export const uncaughtExceptionsCounter = new Counter({
  name: 'nodejs_uncaught_exceptions_total',
  help: 'Total number of uncaught exceptions or unhandled rejections',
})

// 11. Гистограмма длительности запросов к БД
export const dbQueryDurationHistogram = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['table', 'operation'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
})

// 12. Гистограмма длительности запросов к внешним API
export const externalApiDurationHistogram = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['service', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
})

// 13. Счетчик вызовов внешних API со статусом
export const externalApiCallsCounter = new Counter({
  name: 'external_api_calls_total',
  help: 'Total number of calls to external APIs',
  labelNames: ['service', 'operation', 'status'],
})

// 14. Gauge для активных запросов к БД
export const dbActiveQueriesGauge = new Gauge({
  name: 'db_active_queries',
  help: 'Number of currently active database queries',
})

export { register }
