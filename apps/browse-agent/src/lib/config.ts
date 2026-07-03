import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { z } from 'zod'

const ConfigSchema = z.object({
  llm: z.object({
    apiKey: z.string().min(1, 'API ключ для LLM не может быть пустым'),
    apiUrl: z.string().default('https://aihubmix.com/v1'),
    model: z.string().default('gpt-4o'),
    ragModel: z.string().default('text-embedding-3-small'),
  }),
  apiKeys: z.object({
    mapbox: z.string().optional(),
    serper: z.string().optional(),
  }).default({}),
  search: z.object({
    preferredSites: z.array(z.string()).default([
      'tripadvisor.com',
      'wikipedia.org',
    ]),
    browserTimeout: z.number().default(20000),
  }).default({
    preferredSites: [
      'trip.com',
      'wikipedia.org',
    ],
    browserTimeout: 20000,
  }),
  paths: z.object({
    targetFile: z.string(),
    outputDir: z.string(),
  }),
  pricing: z.record(
    z.string(),
    z.object({
      prompt: z.number().optional(),
      completion: z.number().optional(),
      total: z.number().optional(),
    }),
  ).default({}),
})

export type AppConfig = z.infer<typeof ConfigSchema>

function loadConfig(): AppConfig {
  const configPath = path.resolve(process.cwd(), 'config.json')

  if (!fs.existsSync(configPath)) {
    console.error(pc.red(`❌ Ошибка: Файл конфигурации не найден по пути: ${configPath}`))
    process.exit(1)
  }

  try {
    const rawData = fs.readFileSync(configPath, 'utf-8')
    const parsedData = JSON.parse(rawData)
    return ConfigSchema.parse(parsedData)
  }
  catch (error: unknown) {
    console.error(pc.red('❌ Ошибка при загрузке или валидации config.json:'))

    if (error instanceof z.ZodError) {
      error.issues.forEach(e => console.error(pc.yellow(` - [${e.path.join('.')}] ${e.message}`)))
    }
    else if (error instanceof Error) {
      console.error(pc.yellow(error.message))
    }
    else {
      console.error(error)
    }

    process.exit(1)
  }
}

export const config = loadConfig()
