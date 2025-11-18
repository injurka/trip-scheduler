/* eslint-disable no-console */

import type { WebDriver } from 'selenium-webdriver'
import * as cheerio from 'cheerio'
import { Builder, By, until } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'
import { z } from 'zod'

const RecommendationSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  image: z.string().url(),
})

const RecommendationsSchema = z.array(RecommendationSchema)

type Recommendation = z.infer<typeof RecommendationSchema>

interface ScrapeOptions {
  url: string
}

export async function scrapeTripAdvisor(options: ScrapeOptions): Promise<Recommendation[]> {
  const { url } = options
  console.log(`Attempting to scrape ${url} with Selenium WebDriver...`)

  // Объявляем переменную driver здесь, чтобы она была доступна в блоке finally
  let driver: WebDriver | null = null

  try {
    // 1. Настраиваем опции для запуска Chrome в "безголовом" режиме (без GUI)
    const chromeOptions = new Options()
    chromeOptions.addArguments('--no-sandbox') // Важные флаги, как и в Puppeteer
    chromeOptions.addArguments('--disable-dev-shm-usage') // Помогает избежать проблем в Docker/Linux
    chromeOptions.addArguments('--disable-gpu') // Иногда требуется на серверах без GPU

    // 2. Создаем и запускаем экземпляр браузера
    console.log('Launching headless Chrome browser...')
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build()

    // 3. Переходим по указанному URL
    console.log(`Navigating to ${url}...`)
    await driver.get(url)

    // 4. Ждем, пока нужный нам контент не появится на странице
    // Это ключевой шаг: мы даем JavaScript сайта время на загрузку и отрисовку данных.
    // Мы ждем появления первой карточки с достопримечательностью.
    const cardSelectorCss = 'div[data-part="ListSections"] div[data-automation="cardWrapper"]'
    console.log(`Waiting for attraction cards to load (selector: ${cardSelectorCss})...`)
    await driver.wait(until.elementLocated(By.css(cardSelectorCss)), 20000) // Ждем до 20 секунд
    console.log('Attraction cards have loaded.')

    // 5. Получаем полный HTML-код страницы ПОСЛЕ того, как JavaScript отработал
    const html = await driver.getPageSource()
    console.log('Successfully retrieved rendered HTML content.')

    // 6. Передаем HTML в Cheerio для парсинга (ваша существующая логика)
    const $ = cheerio.load(html)

    const cardElements = $(cardSelectorCss)
    console.log(`Found ${cardElements.length} attraction cards using selector.`)

    if (cardElements.length === 0) {
      console.error('Scraping failed: The necessary data is not present in the HTML even after browser rendering.')
      return []
    }

    const allRecommendations: Recommendation[] = []

    cardElements.each((_index, element) => {
      const card = $(element)
      const linkElement = card.find('a[href*="/Attraction_Review-"]')
      const titleElement = card.find('.VLKGO h3')
      const imageElement = card.find('picture > img')

      const title = titleElement.text()?.replace(/^\d+\.\s*/, '').trim()
      const relativeUrl = linkElement.attr('href')
      const absoluteUrl = relativeUrl ? new URL(relativeUrl, 'https://www.tripadvisor.com').toString() : undefined
      const image = imageElement.attr('src')

      if (title && absoluteUrl && image) {
        allRecommendations.push({
          title,
          url: absoluteUrl,
          image,
        })
      }
    })

    // 7. Валидируем полученные данные
    const validationResult = RecommendationsSchema.safeParse(allRecommendations)
    if (!validationResult.success) {
      console.error('Data validation failed:', validationResult.error)
      return []
    }

    console.log(`Successfully scraped and validated ${validationResult.data.length} recommendations.`)
    return validationResult.data
  }
  catch (error) {
    console.error('An unexpected error occurred during Selenium automation:', error)
    // Возвращаем пустой массив в случае любой ошибки
    return []
  }
  finally {
    // 8. Закрываем браузер (КРАЙНЕ ВАЖНО!)
    // Этот блок выполнится всегда, даже если в try произошла ошибка.
    if (driver) {
      console.log('Closing the browser...')
      await driver.quit()
    }
  }
}
