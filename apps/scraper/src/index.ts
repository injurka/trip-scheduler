/* eslint-disable no-console */
import { promises as fs } from 'node:fs'
import path from 'node:path'

// --- Types & Interfaces ---

export type ScraperProvider = 'trip-advisor' | 'trip-com'
export type ScraperCategory = 'llm' | 'classic'

export interface RunOptions {
  provider: ScraperProvider
  category: ScraperCategory
  // Specific method identifier (e.g., 'http', 'puppeteer', 'list', 'detail')
  method: string
  // Dynamic options (pages, city, etc.)
  cliOptions?: {
    pages?: number
    city?: string
  }
}

// --- Configuration Constants ---

const ARTIFACTS_BASE = './artifacts'
const DEFAULT_CITY = 'Chongqing'

// Trip.com default URL
const TRIP_COM_URL = 'https://ru.trip.com/travel-guide/attraction/chongqing-158/tourist-attractions/?locale=ru_ru'

// TripAdvisor default URL (Classic)
const TRIP_ADVISOR_CLASSIC_URL = 'https://www.tripadvisor.com/Attractions-g294213-Activities-oa0-Chongqing.html'

// --- Main Entry Point ---

export async function runScraper(options: RunOptions) {
  const { provider, method } = options
  console.log(`\n🚀 Запуск: [${provider.toUpperCase()}] -> Метод: [${method}]`)

  try {
    if (provider === 'trip-advisor') {
      await handleTripAdvisor(options)
    }
    else if (provider === 'trip-com') {
      await handleTripCom(options)
    }
    else {
      throw new Error(`Неизвестный провайдер: ${provider}`)
    }
  }
  catch (error) {
    console.error(`\n❌ Критическая ошибка при выполнении (${provider}/${method}):`, error)
  }
}

// --- TripAdvisor Handler ---

async function handleTripAdvisor(options: RunOptions) {
  const { category, method, cliOptions } = options
  const city = cliOptions?.city || DEFAULT_CITY

  // 1. LLM Strategy
  if (category === 'llm') {
    const { scrapeTripAdvisor } = await import('./scrapper-llm/trip-advisor/index.js')

    const llmOptions = {
      stage: method as 'list' | 'detail',
      city,
      pages: cliOptions?.pages ?? 1,
      maxDetails: 5,
    }

    console.log(`📡 Запуск LLM Scraper для этапа: ${method}`)
    await scrapeTripAdvisor(llmOptions)
  }
  // 2. Classic Strategy (Code-based)
  else {
    const { scrapeTripAdvisor } = await import(`./scraper-parse/trip-advisor/${method}/index.ts`)

    let scraperOptions: any = {}
    const url = TRIP_ADVISOR_CLASSIC_URL

    switch (method) {
      case 'api': {
        const apiKey = process.env.TRIPADVISOR_API_KEY || 'YOUR_API_KEY_HERE'
        scraperOptions = { apiKey, latLong: '29.5630,106.5516', category: 'attractions', language: 'en' }
        break
      }
      case 'http':
      case 'selenium': {
        scraperOptions = { url }
        break
      }
      case 'playwright': {
        scraperOptions = {
          url,
          headless: false,
          maxPages: cliOptions?.pages || 1,
          userDataDir: path.resolve(process.cwd(), 'playwright_profile'),
        }
        break
      }
      case 'puppeteer': {
        scraperOptions = {
          url,
          headless: false,
          maxPages: cliOptions?.pages || 1,
          executablePath: '/usr/bin/google-chrome-stable', // Adjust if needed
          userDataDir: path.resolve(process.cwd(), 'puppeteer_profile'),
        }
        break
      }
    }

    console.log(`🕷️ Запуск классического скрапера: ${method}`)
    const results = await scrapeTripAdvisor(scraperOptions)

    // Save results for classic scrapers
    if (results && Array.isArray(results) && results.length > 0) {
      await saveArtifacts('trip-advisor', `classic-${method}-list.json`, results)
    }
    else {
      console.log('⚠️ Данные не найдены или массив пуст.')
    }
  }
}

// --- Trip.com Handler ---

async function handleTripCom(options: RunOptions) {
  const { category, method, cliOptions } = options

  if (category === 'classic') {
    if (method === 'http') {
      const { scrapeTripCom } = await import('./scraper-parse/trip-com/http/scrape-trip-com.js')
      console.log(`🕷️ Запуск Trip.com HTTP скрапера...`)
      const results = await scrapeTripCom({ url: TRIP_COM_URL })
      await saveResults(results)
    }
    else if (method === 'puppeteer') {
      const { scrapeTripCom } = await import('./scraper-parse/trip-com/puppeteer/scrape-trip-com.js')
      console.log(`🕷️ Запуск Trip.com Puppeteer скрапера (SPA)...`)

      const results = await scrapeTripCom({
        url: TRIP_COM_URL,
        maxPages: cliOptions?.pages || 1,
        headless: false, // Открываем браузер, чтобы видеть процесс (SPA часто капризны)
        userDataDir: path.resolve(process.cwd(), 'trip_com_profile'),
      })
      await saveResults(results)
    }
    else {
      console.warn(`Метод ${method} для Trip.com еще не реализован.`)
    }
  }

  async function saveResults(results: any) {
    if (results && results.length > 0) {
      await saveArtifacts('trip-com', `chongqing-${method}-list.json`, results)
    }
    else {
      console.log('⚠️ Данные не найдены.')
    }
  }
}

// --- Helper: Save Artifacts ---

async function saveArtifacts(provider: string, filename: string, data: any) {
  const dir = path.join(ARTIFACTS_BASE, provider)
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))

  console.log(`💾 Результаты сохранены в: ${filePath}`)
}
