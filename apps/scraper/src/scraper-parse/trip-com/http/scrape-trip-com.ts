/* eslint-disable no-console */
import type { TripComAttraction } from '~/schemas/trip-com'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { TripComListSchema } from '~/schemas/trip-com'

interface ScrapeOptions {
  url: string
}

export async function scrapeTripCom(options: ScrapeOptions): Promise<TripComAttraction[]> {
  const { url } = options
  console.log(`[Trip.com] Запуск HTTP скрапера для: ${url}`)

  try {
    // 1. Получаем HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/',
        'Cookie': 'locale=ru-RU; currency=RUB;', // Пытаемся форсировать локаль и валюту
      },
    })

    const html = response.data
    const $ = cheerio.load(html)

    // 2. Находим контейнер списка (основываясь на вашем HTML)
    // Класс OnlinePoiList_listBox__XDyli может меняться со временем, поэтому используем частичное совпадение если нужно,
    // но сейчас берем точно из вашего примера.
    const listItems = $('div[class*="OnlinePoiList_listBox"] > a')

    console.log(`[Trip.com] Найдено элементов: ${listItems.length}`)

    const attractions: TripComAttraction[] = []

    listItems.each((_, element) => {
      const el = $(element)

      // --- URL ---
      const relativeUrl = el.attr('href')
      const absoluteUrl = relativeUrl ? new URL(relativeUrl, 'https://www.trip.com').toString() : ''

      // --- Name ---
      // Удаляем "1. ", "2. " в начале названия
      const rawName = el.find('h2[class*="OnlinePoiCell_titleText"]').text().trim()
      const name = rawName.replace(/^\d+\.\s*/, '')

      // --- Image ---
      const imageUrl = el.find('img[class*="taro-img__content"]').attr('src') || null

      // --- Score ---
      const scoreText = el.find('span[class*="HotScore_scoreText"]').text().trim()
      const score = scoreText ? Number.parseFloat(scoreText) : null

      // --- Review Count ---
      // Пример: "15.2k reviews"
      const reviewCount = el.find('span[class*="Reviews_tripScoreViews"]').text().trim() || null

      // --- Category Tags ---
      const tags: string[] = []
      el.find('div[class*="ThemeTags_container"] span[class*="ThemeTags_themeText"]').each((_, tagEl) => {
        const text = $(tagEl).text().trim()
        if (text)
          tags.push(text)
      })

      // --- Price ---
      // Пример: "1,375.14" (находим внутри Price_priceValue)
      const priceText = el.find('span[class*="Price_priceValue"]').text().trim()
      // Удаляем запятые перед парсингом числа
      const price = priceText ? Number.parseFloat(priceText.replace(/,/g, '')) : null

      // --- Description / User Comment ---
      const description = el.find('span[class*="Comment_commentText"]').text().trim() || null

      // --- ID ---
      // Пытаемся вытащить ID из URL (например, attraction/chongqing/name-12345)
      const idMatch = relativeUrl?.match(/-(\d+)\?/)
      const id = idMatch ? idMatch[1] : undefined

      if (name && absoluteUrl) {
        attractions.push({
          id,
          name,
          url: absoluteUrl,
          imageUrl,
          score,
          reviewCount,
          categoryTags: tags.length > 0 ? tags : null,
          price,
          description,
        })
      }
    })

    // 3. Валидация
    const validationResult = TripComListSchema.safeParse(attractions)

    if (validationResult.success) {
      console.log(`[Trip.com] Успешно распарсено ${validationResult.data.length} карточек.`)
      return validationResult.data
    }
    else {
      console.error('[Trip.com] Ошибка валидации данных:', validationResult.error)
      return []
    }
  }
  catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Trip.com] Ошибка HTTP запроса: ${error.message}`)
      if (error.response?.status === 403) {
        console.warn('[Trip.com] Внимание: Получен 403 Forbidden. Trip.com часто блокирует простые запросы. Возможно, потребуется использовать Puppeteer/Playwright.')
      }
    }
    else {
      console.error('[Trip.com] Неизвестная ошибка:', error)
    }
    return []
  }
}
