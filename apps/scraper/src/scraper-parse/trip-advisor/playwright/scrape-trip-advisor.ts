/* eslint-disable no-console */
import type { Page } from 'playwright'
import { chromium } from 'playwright'
import { z } from 'zod'

const RecommendationSchema = z.object({
  title: z.string().min(1, { message: 'Заголовок не может быть пустым' }),
  url: z.string().url({ message: 'Некорректный URL достопримечательности' }),
  image: z.string().url({ message: 'Некорректный URL изображения' }),
})

type Recommendation = z.infer<typeof RecommendationSchema>
const RecommendationsSchema = z.array(RecommendationSchema)

interface ScrapeOptions {
  url: string
  headless?: boolean
  maxPages?: number
  userDataDir?: string
}

const randomDelay = (min: number, max: number) => new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min))

async function randomMouseMovements(page: Page) {
  console.log('Simulating mouse movements...')
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(
      Math.random() * 1000 + 100,
      Math.random() * 600 + 100,
      { steps: 10 },
    )
    await randomDelay(200, 500)
  }
}

async function warmUpSession(page: Page) {
  console.log('Warming up session...')
  await page.goto('https://www.tripadvisor.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await randomDelay(3000, 5000)
  await randomMouseMovements(page)
  console.log('Session warmed up.')
}

export async function scrapeTripAdvisor(options: ScrapeOptions): Promise<Recommendation[]> {
  const { url, headless = true, maxPages = 1, userDataDir } = options
  const allRecommendations: Recommendation[] = []

  try {
    const context = await chromium.launchPersistentContext(userDataDir!, {
      headless,
      viewport: { width: 1366, height: 768 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      extraHTTPHeaders: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    const page = await context.newPage()

    await warmUpSession(page)

    console.log(`Navigating to target URL...`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await randomDelay(4000, 7000)

    let currentPage = 1
    while (currentPage <= maxPages) {
      console.log(`Scraping page ${currentPage}...`)
      await randomMouseMovements(page)

      const cardLocator = page.locator('div[data-part="ListSections"] div[data-automation="cardWrapper"]')

      try {
        await cardLocator.first().waitFor({ state: 'visible', timeout: 30000 })
        console.log('Attraction cards are visible.')
      }
      catch (e) {
        console.error('Could not find card wrappers.', e)
        await page.screenshot({ path: `error_screenshot_page_${currentPage}.png`, fullPage: true })
        console.log(`A screenshot 'error_screenshot_page_${currentPage}.png' has been saved.`)
        break
      }

      console.log('Scrolling page to load all content...')
      await page.evaluate(async () => {
        for (let i = 0; i < document.body.scrollHeight; i += 100) {
          window.scrollTo(0, i)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 50))
        }
      })

      await randomDelay(2000, 4000)

      const rawData = await cardLocator.evaluateAll((elements) => {
        return elements.map((element) => {
          const linkElement = element.querySelector<HTMLAnchorElement>('a[href*="/Attraction_Review-"]')
          const titleElement = element.querySelector<HTMLHeadingElement>('.VLKGO h3')
          const imageElement = element.querySelector<HTMLImageElement>('picture > img')

          if (!linkElement || !titleElement || !imageElement)
            return null

          const title = titleElement.textContent?.replace(/^\d+\.\s*/, '').trim() || ''
          const url = linkElement.href
          const imageSrcSet = imageElement.getAttribute('srcset')
          let image = imageElement.src || ''
          if (imageSrcSet) {
            const sources = imageSrcSet.split(',').map(s => s.trim().split(' ')[0])
            image = sources[sources.length - 1]
          }
          return { title, url, image }
        }).filter(Boolean)
      })

      try {
        const validatedData = RecommendationsSchema.parse(rawData)
        allRecommendations.push(...validatedData)
      }
      catch (validationError) {
        console.error('Data validation failed for some items:', validationError)
      }

      const nextButtonLocator = page.locator('a[data-smoke-attr="pagination-next-arrow"]')
      if (await nextButtonLocator.isVisible() && currentPage < maxPages) {
        console.log(`Navigating to page ${currentPage + 1}...`)
        await randomDelay(3000, 6000)
        await nextButtonLocator.click()
        await page.waitForLoadState('domcontentloaded')
        currentPage++
      }
      else {
        console.log('No more pages to scrape or maxPages limit reached.')
        break
      }
    }

    await context.close()
    return allRecommendations
  }
  catch (error) {
    console.error('A critical error occurred during scraping:', error)
    return []
  }
}
