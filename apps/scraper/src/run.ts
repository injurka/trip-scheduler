/* eslint-disable no-console */

import prompts from 'prompts'
import { runScraper } from './index'

const scraperChoices = [
  { title: 'LLM - Этап 1: Сбор списков достопримечательностей', value: 'llm-list' },
  { title: 'LLM - Этап 2: Сбор деталей о достопримечательностях', value: 'llm-detail' },
  { title: '--- Другие скраперы ---', disabled: true },
  { title: 'API (Official)', value: 'api' },
  { title: 'HTTP (Cheerio-only)', value: 'http' },
  { title: 'Playwright', value: 'playwright' },
  { title: 'Puppeteer', value: 'puppeteer' },
  { title: 'Selenium', value: 'selenium' },
]

async function selectAndRun() {
  const response = await prompts({
    type: 'select',
    name: 'scraperType',
    message: 'Какой этап скрапинга вы хотите запустить?',
    choices: scraperChoices,
    initial: 0,
  })

  if (response.scraperType) {
    const cliOptions: { pages?: number } = {}

    if (response.scraperType === 'llm-list') {
      const pagesResponse = await prompts({
        type: 'number',
        name: 'pages',
        message: 'Сколько страниц списка достопримечательностей обработать?',
        initial: 1,
        min: 1,
      })
      if (typeof pagesResponse.pages === 'number') {
        cliOptions.pages = pagesResponse.pages
      }
      else {
        console.log('Количество страниц не указано. Выход.')
        return
      }
    }
    await runScraper(response.scraperType, cliOptions)
  }
  else {
    console.log('Этап не выбран. Выход.')
  }
}

selectAndRun().catch((error) => {
  console.error('Произошла ошибка во время выбора скрапера:', error)
})
