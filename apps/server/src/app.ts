import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { serveStatic } from 'hono/bun'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { Logger } from '~/lib/logger'
import { authController } from './api/auth.controller'
import { avatarController } from './api/avatar.controller'
import { llmController } from './api/llm.controller'
import { uploadFileController } from './api/upload.controller'
import { createContext } from './lib/trpc'
import { appRouter } from './router'
import { httpRequestCounter, httpRequestDurationHistogram, register } from './services/metrics.service'

const logger = new Logger()

class Server {
  private app: Hono

  // Список разрешенных источников перенесен внутрь класса для инкапсуляции
  private allowedOrigins = [
    'http://localhost:1420', // Vite dev server для веб-разработки
    'http://localhost:4173', // Vite preview
    'capacitor://localhost', // Android Capacitor
    'http://localhost', // Capacitor
    'https://localhost', // Capacitor
    'http://trip-scheduler.ru', // Production-домен
    'https://trip-scheduler.ru', // Production-домен с https
  ]

  constructor() {
    this.app = new Hono()

    this.initializeMiddlewares()
    this.initializeRoutes()
    this.initializeStaticFileRoutes()
    this.initializeErrorHandlers()
  }

  public getApp() {
    return this.app
  }

  private initializeMiddlewares() {
    // Middleware для метрик Prometheus
    this.app.use('*', async (c, next) => {
      const start = Date.now()
      try {
        await next()
      }
      finally {
        const duration = (Date.now() - start) / 1000
        const path = new URL(c.req.url).pathname

        if (path !== '/metrics') {
          httpRequestDurationHistogram.observe(
            { method: c.req.method, path, status_code: c.res.status },
            duration,
          )
          httpRequestCounter.inc({
            method: c.req.method,
            path,
            status_code: c.res.status,
          })
        }
      }
    })

    // Middleware для CORS
    this.app.use(
      '*',
      cors({
        origin: (origin) => {
          if (!origin || this.allowedOrigins.includes(origin)) {
            return origin
          }
          return null
        },
        credentials: true,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    )

    logger.log('Middlewares initialized')
  }

  private initializeRoutes() {
    // Определение API маршрутов
    const apiRoutes = new Hono()
      .use('/upload', bodyLimit({
        maxSize: 25 * 1024 * 1024,
      }))
      .post('/upload', uploadFileController)
      .route('/avatar', avatarController)
      .route('/auth', authController)
      .route('/llm', llmController)

    this.app.route('/api', apiRoutes)

    // Маршрут для tRPC
    this.app.use(
      '/trpc/*',
      trpcServer({
        router: appRouter,
        createContext,
        onError: ({ error, path }) => {
          console.error(`tRPC Error on ${path}:`, error)
        },
      }),
    )

    // Маршрут для метрик
    this.app.get('/metrics', async (c) => {
      c.header('Content-Type', register.contentType)
      return c.body(await register.metrics())
    })

    logger.log('Routes initialized')
  }

  private initializeStaticFileRoutes() {
    this.app.use('/static/*', serveStatic({ root: './' }))
    logger.log('Static file routes initialized')
  }

  private initializeErrorHandlers() {
    // Обработчик 404
    this.app.notFound(c => c.json({ error: 'Not Found' }, 404))

    // Глобальный обработчик ошибок
    this.app.onError((error, c) => {
      if (error instanceof HTTPException) {
        return error.getResponse()
      }
      console.error('Application error:', error)
      return c.json(
        {
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development'
            ? error.message
            : 'Something went wrong',
        },
        500,
      )
    })

    logger.log('Error handlers initialized')
  }
}

const server = new Server()

export default server
