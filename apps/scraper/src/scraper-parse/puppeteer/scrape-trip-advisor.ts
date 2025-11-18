/* eslint-disable no-console */
import type { Browser, ElementHandle, LaunchOptions, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { z } from 'zod'

puppeteer.use(StealthPlugin())

const RecommendationSchema = z.object({
  title: z.string().min(1, { message: 'Заголовок не может быть пустым' }),
  url: z.string().url({ message: 'Некорректный URL достопримечательности' }),
  image: z.string().url({ message: 'Некорректный URL изображения' }),
})

type Recommendation = z.infer<typeof RecommendationSchema>
const RecommendationsSchema = z.array(RecommendationSchema)

interface ScrapeOptions {
  url: string
  headless?: LaunchOptions['headless']
  maxPages?: number
  executablePath?: string
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

async function humanClick(page: Page, element: ElementHandle<Element> | null) {
  if (!element)
    throw new Error('Element for clicking not found')

  const box = await element.boundingBox()
  if (!box)
    throw new Error('Could not get bounding box for element')

  await page.mouse.move(
    box.x + box.width / 2 + (Math.random() - 0.5) * box.width * 0.2,
    box.y + box.height / 2 + (Math.random() - 0.5) * box.height * 0.2,
    { steps: 20 },
  )
  await randomDelay(100, 300)
  await page.mouse.down()
  await randomDelay(80, 150)
  await page.mouse.up()
}

async function handleCaptcha(page: Page) {
  const captchaSelector = 'iframe[title="Verification puzzle"]'
  try {
    console.log('Checking for CAPTCHA...')
    await page.waitForSelector(captchaSelector, { timeout: 10000 })
    console.log('CAPTCHA detected! Please solve it manually.')
    console.log('You have 90 seconds to solve the puzzle...')
    await page.waitForSelector(captchaSelector, { hidden: true, timeout: 90000 })
    console.log('CAPTCHA seems to be solved. Continuing...')
  }
  catch {
    console.log('No CAPTCHA detected or it timed out, continuing...')
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
  const { url, headless = 'shell', maxPages = 1, executablePath, userDataDir } = options
  const allRecommendations: Recommendation[] = []

  let browser: Browser | undefined
  let page: Page | undefined

  const launchOptions: LaunchOptions = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
    ],
    executablePath,
    userDataDir,
  }

  try {
    browser = await puppeteer.launch(launchOptions)
    page = await browser.newPage()

    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    })

    await page.setViewport({ width: 1366, height: 768 })

    await warmUpSession(page)

    console.log(`Navigating to target URL...`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await randomDelay(4000, 7000)

    await handleCaptcha(page)

    let currentPage = 1
    while (currentPage <= maxPages) {
      console.log(`Scraping page ${currentPage}...`)

      await randomMouseMovements(page)

      const listContainerSelector = 'div[data-part="ListSections"]'
      const cardSelector = `${listContainerSelector} div[data-automation="cardWrapper"]`

      try {
        await page.waitForSelector(cardSelector, { visible: true, timeout: 30000 })
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

      const rawData = await page.evaluate((selector) => {
        const items: Omit<Recommendation, 'id'>[] = []
        const elements = document.querySelectorAll<HTMLElement>(selector)

        elements.forEach((element) => {
          const linkElement = element.querySelector<HTMLAnchorElement>('a[href*="/Attraction_Review-"]')
          const titleElement = element.querySelector<HTMLHeadingElement>('.VLKGO h3')
          const imageElement = element.querySelector<HTMLImageElement>('picture > img')

          if (linkElement && titleElement && imageElement) {
            const title = titleElement.textContent?.replace(/^\d+\.\s*/, '').trim() || ''
            const url = linkElement.href

            const imageSrcSet = imageElement.getAttribute('srcset')
            let image = imageElement.src || ''
            if (imageSrcSet) {
              const sources = imageSrcSet.split(',').map(s => s.trim().split(' ')[0])
              image = sources[sources.length - 1]
            }

            if (title && url && image) {
              items.push({ title, url, image })
            }
          }
        })
        return items
      }, cardSelector)

      try {
        const validatedData = RecommendationsSchema.parse(rawData)
        allRecommendations.push(...validatedData)
      }
      catch (validationError) {
        console.error('Data validation failed for some items:', validationError)
      }

      const nextButtonSelector = 'a[data-smoke-attr="pagination-next-arrow"]'
      const nextButton = await page.$(nextButtonSelector)

      if (nextButton && currentPage < maxPages) {
        console.log(`Navigating to page ${currentPage + 1}...`)
        await randomDelay(3000, 6000)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
          humanClick(page, nextButton),
        ])
        await handleCaptcha(page)
        currentPage++
      }
      else {
        console.log('No more pages to scrape or maxPages limit reached.')
        break
      }
    }

    return allRecommendations
  }
  catch (error) {
    console.error('A critical error occurred during scraping:', error)
    if (page) {
      await page.screenshot({ path: 'critical_error_screenshot.png', fullPage: true })
      console.log(`A screenshot 'critical_error_screenshot.png' has been saved for debugging.`)
    }
    return []
  }
  finally {
    if (browser)
      await browser.close()
  }
}
