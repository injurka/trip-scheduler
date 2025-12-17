import { swaggerUI } from '@hono/swagger-ui'
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { createOpenApiFetchHandler, generateOpenApiDocument } from 'trpc-to-openapi'
import { Logger } from '~/lib/logger'
import { authController } from './api/auth.controller'
import { avatarController } from './api/avatar.controller'
import { imageController } from './api/image.controller'
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
    'https://tripsh.vercel.app', // Vercel
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
      .post('/upload', uploadFileController)
      .route('/avatar', avatarController)
      .route('/auth', authController)
      .route('/llm', llmController)

    this.app.route('/api', apiRoutes)
    this.app.route('/image', imageController)

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

    // REST-обработчик для OpenAPI (Swagger) endpoints
    // Перехватывает запросы, не попавшие в предыдущие роуты, и пытается выполнить их через tRPC
    this.app.all('/*', async (c, next) => {
      if (c.req.path.startsWith('/static/')
        || c.req.path === '/metrics'
        || c.req.path === '/openapi.json'
        || c.req.path === '/docs') {
        return next()
      }

      const res = await createOpenApiFetchHandler({
        endpoint: '/', // Корневой путь, так как в meta.openapi paths указаны от корня (например, /trips/cities)
        router: appRouter,
        createContext: () => createContext({} as any, c),
        req: c.req.raw,
        onError: () => { },
      })

      if (!res || res.status === 404) {
        return next()
      }

      return res
    })

    // Маршрут для метрик
    this.app.get('/metrics', async (c) => {
      c.header('Content-Type', register.contentType)
      return c.body(await register.metrics())
    })

    // 1. Генерируем документ
    const openApiDocument = generateOpenApiDocument(appRouter, {
      title: 'tRPC OpenAPI',
      version: '1.0.0',
      baseUrl: `${import.meta.env.API_URL}`,
    })

    // 2. Отдаем JSON спецификации
    this.app.get('/openapi.json', c => c.json(openApiDocument))

    // 3. Рендерим Swagger UI
    this.app.get('/docs', swaggerUI({ url: '/openapi.json' }))

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
