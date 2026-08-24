import type { Browser, Page } from 'puppeteer'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import pc from 'picocolors'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import TurndownService from 'turndown'
import { config } from './config.js'

puppeteer.use(StealthPlugin())

export class BrowserService {
  private browser: Browser | null = null
  public page: Page | null = null

  async init() {
    console.log(pc.cyan('🤖 Запуск браузера...'))
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--start-maximized'],
    })

    const pages = await this.browser.pages()
    this.page = pages[0]
    await this.page.setViewport({ width: 1280, height: 800 })
  }

  async googleSearch(query: string): Promise<string> {
    if (config.apiKeys.serper) {
      console.log(pc.blue(`🌍 Поиск через Serper API: ${query}`))
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': config.apiKeys.serper,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: query, gl: 'ru', hl: 'ru' }),
        })
        const json = await res.json()
        if (json.organic && json.organic.length > 0) {
          return json.organic.map((r: any) => `Текст: "${r.title} - ${r.snippet}" | URL: ${r.link}`).join('\n')
        }
        return 'Ничего не найдено через API.'
      }
      catch (e: any) {
        return `Ошибка Serper API: ${e.message}`
      }
    }

    if (!this.page)
      return 'Ошибка: страница не инициализирована'
    console.log(pc.blue(`🌍 Поиск в Google: ${query}`))
    try {
      await this.page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ru`, {
        waitUntil: 'domcontentloaded',
        timeout: config.search.browserTimeout,
      })
      const results = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('#search a'))
          .filter(a => a.querySelector('h3'))
          .map(a => `Текст: "${a.querySelector('h3')?.textContent}" | URL: ${(a as HTMLAnchorElement).href}`)
          .join('\n')
      })
      return results || 'Ничего не найдено. Возможно Google показал капчу.'
    }
    catch (e: any) {
      if (e.message.includes('Timeout') || e.name === 'TimeoutError') {
        console.log(pc.yellow(`⏳ Google не ответил вовремя. Таймаут.`))
        return `Ошибка: Поисковик загружался слишком долго. Попробуйте другой запрос или инструмент.`
      }
      return `Ошибка поиска: ${e.message}`
    }
  }

  async goto(url: string): Promise<string> {
    if (!this.page)
      return 'Ошибка'
    console.log(pc.blue(`🔗 Переход по ссылке: ${url} (Ожидание макс. ${config.search.browserTimeout / 1000}с)`))
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.search.browserTimeout,
      })
      await new Promise(r => setTimeout(r, 2500))
      return `Успешно перешли на ${url}. Текущий заголовок: ${await this.page.title()}`
    }
    catch (error: any) {
      if (error.message.includes('Timeout') || error.name === 'TimeoutError') {
        console.log(pc.yellow(`⏳ Таймаут при загрузке: ${url}. Сайт пропущен.`))
        return `ВНИМАНИЕ ОШИБКА: Сайт "${url}" загружался слишком долго и недоступен. ПРОПУСТИ этот сайт и немедленно выбери другой URL из результатов поиска для получения данных.`
      }
      return `Ошибка при переходе: ${error.message}`
    }
  }

  async getPageContent(): Promise<string> {
    if (!this.page)
      return 'Ошибка'
    console.log(pc.blue('📄 Чтение контента страницы...'))

    await this.page.evaluate(() => window.scrollBy(0, 1500)).catch(() => { })
    await new Promise(r => setTimeout(r, 1500))

    const MAX_LENGTH = 100000 // Лимит в 100к символов

    try {
      const html = await this.page.content()
      const doc = new JSDOM(html, { url: this.page.url() })
      const reader = new Readability(doc.window.document)
      const article = reader.parse()

      if (article && article.content) {
        const turndownService = new TurndownService({ headingStyle: 'atx' })
        const markdown = turndownService.turndown(article.content)

        let finalMd = `--- ТЕКСТ СТРАНИЦЫ (MARKDOWN) ---\n${markdown}`
        if (finalMd.length > MAX_LENGTH) {
          finalMd = `${finalMd.slice(0, MAX_LENGTH)}\n\n[... ТЕКСТ ОБРЕЗАН ДЛЯ ЭКОНОМИИ ПАМЯТИ ...]`
        }
        return finalMd
      }
    }
    catch {
      console.log(pc.yellow('⚠ Readability/Turndown не справились, использую базовый парсинг...'))
    }

    const fallbackText = await this.page.evaluate(() => document.body.textContent).catch(() => 'Не удалось прочитать текст.')
    let finalFallback = `--- ТЕКСТ СТРАНИЦЫ ---\n${fallbackText}`

    if (finalFallback.length > MAX_LENGTH) {
      finalFallback = `${finalFallback.slice(0, MAX_LENGTH)}\n\n[... ТЕКСТ ОБРЕЗАН ДЛЯ ЭКОНОМИИ ПАМЯТИ ...]`
    }

    return finalFallback
  }

  async getImages(): Promise<string> {
    if (!this.page)
      return 'Ошибка'
    console.log(pc.blue('🖼 Извлечение картинок...'))

    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 800)).catch(() => { })
      await new Promise(r => setTimeout(r, 600))
    }

    const images = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map(img => img.src || img.getAttribute('data-src') || '')
        .filter(src => src.startsWith('http')
          && !src.includes('logo')
          && !src.includes('icon')
          && !src.endsWith('.svg')
          && !src.includes('data:image'))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 30)
        .join('\n')
    }).catch(() => '')

    return images.length > 0 ? images : 'Картинки не найдены.'
  }

  async close() {
    if (this.browser)
      await this.browser.close()
  }
}
