/* eslint-disable no-console */
import path from 'node:path'

// A type guard to check for valid scraper types
const SCRAPER_TYPES = ['api', 'http', 'llm-list', 'llm-detail', 'playwright', 'puppeteer', 'selenium'] as const
type ScraperType = (typeof SCRAPER_TYPES)[number]

function isValidScraperType(type: string): type is ScraperType {
  return SCRAPER_TYPES.includes(type as ScraperType)
}

// Generic types for scraper functions and their options
type ScrapeFunction = (options: any) => Promise<any>

interface CliOptions {
  pages?: number
}

async function main(scraperType: ScraperType, cliOptions?: CliOptions) {
  console.log(`Запуск скрапера в режиме [${scraperType}]...`)

  let options: object = {}
  let runner: ScrapeFunction

  if (scraperType.startsWith('llm')) {
    const { scrapeTripAdvisor } = await import('./scrapper-llm/trip-advisor/index.js')
    runner = scrapeTripAdvisor
    options = {
      stage: scraperType.split('-')[1], // 'list' or 'detail'
      city: 'Chongqing',
      pages: cliOptions?.pages ?? 1, // Only for 'list' stage
      maxDetails: 5, // Only for 'detail' stage
    }
  }
  else {
    // Dynamically import the chosen scraper module from scraper-parse
    const { scrapeTripAdvisor } = await import(`./scraper-parse/${scraperType}/index.ts`)
    runner = scrapeTripAdvisor
    const url = 'https://www.tripadvisor.com/Attractions-g294213-Activities-oa0-Chongqing.html'

    // Configure options based on the selected scraper
    switch (scraperType) {
      case 'api': {
        const MY_API_KEY = process.env.TRIPADVISOR_API_KEY || 'YOUR_API_KEY_HERE'
        if (MY_API_KEY === 'YOUR_API_KEY_HERE')
          console.warn('Внимание: используется временный API ключ. Задайте переменную окружения TRIPADVISOR_API_KEY.')

        options = {
          apiKey: MY_API_KEY,
          latLong: '29.5630,106.5516',
          category: 'attractions',
          language: 'en',
        }
        break
      }
      case 'http':
      case 'selenium': {
        options = { url }
        break
      }
      case 'playwright': {
        options = { url, headless: false, maxPages: 2, userDataDir: path.resolve(process.cwd(), 'playwright_profile') }
        break
      }
      case 'puppeteer': {
        options = { url, headless: false, maxPages: 2, executablePath: '/usr/bin/google-chrome-stable', userDataDir: path.resolve(process.cwd(), 'puppeteer_profile') }
        break
      }
    }
  }

  await runner(options)
  console.log(`\n--- Скрапер [${scraperType}] завершил работу. Проверьте директорию /artifacts или логи для деталей. ---`)
}

export async function runScraper(scraperType: string, cliOptions?: CliOptions) {
  if (isValidScraperType(scraperType))
    await main(scraperType, cliOptions).catch(error => console.error(`Необработанная ошибка в main для ${scraperType}:`, error))
  else
    console.error(`Ошибка: "${scraperType}" неверный тип скрапера. Доступные опции: ${SCRAPER_TYPES.join(', ')}.`)
}
