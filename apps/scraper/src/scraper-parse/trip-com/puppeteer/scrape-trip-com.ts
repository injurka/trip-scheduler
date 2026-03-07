/* eslint-disable no-console */
import type { Browser, Page } from 'puppeteer'
import type { TripComAttraction } from '~/schemas/trip-com'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { TripComListSchema } from '~/schemas/trip-com'

puppeteer.use(StealthPlugin())

interface ScrapeOptions {
  url: string
  headless?: boolean
  maxPages?: number
  userDataDir?: string
}

// Утилита для задержек
const randomDelay = (min: number, max: number) => new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min))

// Имитация движения мыши
async function randomMouseMovements(page: Page) {
  for (let i = 0; i < 4; i++) { // Чуть больше движений
    await page.mouse.move(
      Math.random() * 1000 + 100,
      Math.random() * 600 + 100,
      { steps: 10 },
    )
    await randomDelay(100, 400)
  }
}

export async function scrapeTripCom(options: ScrapeOptions): Promise<TripComAttraction[]> {
  const { url, headless = false, maxPages = 1, userDataDir } = options
  console.log(`[Trip.com Puppeteer] Запуск. Страниц: ${maxPages}`)

  let browser: Browser | undefined
  let page: Page | undefined
  const allAttractions: TripComAttraction[] = []

  try {
    browser = await puppeteer.launch({
      headless,
      userDataDir,
      defaultViewport: { width: 1440, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    })

    page = await browser.newPage()

    // Маскировка
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    })

    console.log(`[Trip.com Puppeteer] Переход на страницу: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Большая начальная задержка
    await randomDelay(3000, 5000)

    let currentPage = 1

    while (currentPage <= maxPages) {
      console.log(`\n📄 Обработка страницы ${currentPage}...`)

      await randomMouseMovements(page)

      // Медленный скролл для lazy loading
      await page.evaluate(async () => {
        for (let i = 0; i < document.body.scrollHeight; i += 400) {
          window.scrollTo(0, i)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
        }
      })

      // Пауза после скролла перед парсингом
      await randomDelay(1000, 2000)

      // --- ПАРСИНГ ДАННЫХ ---
      const pageData = await page.evaluate(() => {
        const items: any[] = []
        const cards = document.querySelectorAll('div[class*="OnlinePoiList_listBox"] > a')

        cards.forEach((el) => {
          const rawName = el.querySelector('h2[class*="OnlinePoiCell_titleText"]')?.textContent?.trim() || ''
          const name = rawName.replace(/^\d+\.\s*/, '')

          const relativeUrl = el.getAttribute('href')
          const url = relativeUrl ? new URL(relativeUrl, 'https://www.trip.com').toString() : ''

          const imgEl = el.querySelector('img[class*="taro-img__content"]')
          const imageUrl = imgEl?.getAttribute('src') || null

          const scoreText = el.querySelector('span[class*="HotScore_scoreText"]')?.textContent?.trim()
          const score = scoreText ? Number.parseFloat(scoreText) : null

          const reviewCount = el.querySelector('span[class*="Reviews_tripScoreViews"]')?.textContent?.trim() || null

          const priceText = el.querySelector('span[class*="Price_priceValue"]')?.textContent?.trim()
          const price = priceText ? Number.parseFloat(priceText.replace(/,/g, '')) : null

          const tags: string[] = []
          el.querySelectorAll('div[class*="ThemeTags_container"] span[class*="ThemeTags_themeText"]').forEach(t => tags.push(t.textContent?.trim() || ''))

          const description = el.querySelector('span[class*="Comment_commentText"]')?.textContent?.trim() || null

          const idMatch = relativeUrl?.match(/-(\d+)\?/)
          const id = idMatch ? idMatch[1] : undefined

          if (name && url) {
            items.push({
              id,
              name,
              url,
              imageUrl,
              score,
              reviewCount,
              categoryTags: tags.length > 0 ? tags : null,
              price,
              description,
            })
          }
        })
        return items
      })

      const validated = TripComListSchema.safeParse(pageData)
      if (validated.success) {
        console.log(`✅ Найдено элементов на странице: ${validated.data.length}`)
        allAttractions.push(...validated.data)
      }
      else {
        console.error('⚠️ Ошибка валидации данных:', validated.error)
      }

      // Имитация "изучения" данных пользователем перед переходом дальше
      console.log('⏳ Имитация чтения контента (пауза)...')
      await randomDelay(2000, 3000)

      // --- ПАГИНАЦИЯ ---
      if (currentPage < maxPages) {
        console.log('🔄 Поиск кнопки следующей страницы...')

        const nextButtonFound = await page.evaluate((currPage, selectorClass) => {
          // Поиск всех кнопок пагинации по вашему классу
          const buttons = Array.from(document.querySelectorAll(`.${selectorClass.replace(/ /g, '.')}`))

          // 1. Ищем цифру следующей страницы (например "2", если сейчас "1")
          const nextNumBtn = buttons.find(btn => btn.textContent?.trim() === String(currPage + 1))
          if (nextNumBtn) {
            (nextNumBtn as HTMLElement).click()
            return true
          }

          // 2. Ищем стрелку "Вперед" (обычно иконка или 'Next')
          // На Trip.com часто это последняя кнопка без цифры или с иконкой
          const arrowBtn = buttons.find(btn => btn.textContent?.includes('>') || btn.querySelector('i'))
          if (arrowBtn) {
            (arrowBtn as HTMLElement).click()
            return true
          }

          return false
        }, currentPage, 'xtaro-xview Pagination_item__FN_5N')

        if (nextButtonFound) {
          console.log(`➡️ Клик по странице ${currentPage + 1}. Ожидание подгрузки...`)

          // Длинная пауза, так как это SPA - данные грузятся асинхронно
          await randomDelay(2000, 4000)
          currentPage++
        }
        else {
          console.log('⛔ Кнопка следующей страницы не найдена или неактивна. Завершаем.')
          break
        }
      }
      else {
        break
      }
    }

    return allAttractions
  }
  catch (error) {
    console.error('[Trip.com Puppeteer] Критическая ошибка:', error)
    return []
  }
  finally {
    if (browser)
      await browser.close()
  }
}
