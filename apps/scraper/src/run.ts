/* eslint-disable no-console */
import type { RunOptions } from './index'
import prompts from 'prompts'
import { runScraper } from './index'

async function main() {
  console.log('--- Trip Scheduler Scraper CLI ---\n')

  // Step 1: Select Provider
  const providerResponse = await prompts({
    type: 'select',
    name: 'provider',
    message: 'Выберите платформу для скрапинга:',
    choices: [
      { title: 'TripAdvisor', value: 'trip-advisor' },
      { title: 'Trip.com', value: 'trip-com' },
    ],
  })

  if (!providerResponse.provider)
    return

  // Step 2: Select Method based on Provider
  let methodChoices: prompts.Choice[] = []

  if (providerResponse.provider === 'trip-advisor') {
    methodChoices = [
      { title: '🤖 LLM - Step 1: Список (List)', value: 'llm-list', description: 'Сбор ссылок через AI' },
      { title: '🤖 LLM - Step 2: Детали (Detail)', value: 'llm-detail', description: 'Сбор деталей через AI' },
      { title: '----------------', disabled: true },
      { title: '🕸️  Classic: Official API', value: 'classic-api' },
      { title: '🕸️  Classic: HTTP (Cheerio)', value: 'classic-http' },
      { title: '🕸️  Classic: Puppeteer', value: 'classic-puppeteer' },
      { title: '🕸️  Classic: Playwright', value: 'classic-playwright' },
      { title: '🕸️  Classic: Selenium', value: 'classic-selenium' },
    ]
  }
  else if (providerResponse.provider === 'trip-com') {
    methodChoices = [
      { title: '🕸️  Classic: HTTP Parse', value: 'classic-http' },
      { title: '🕸️  Classic: Puppeteer (SPA)', value: 'classic-puppeteer', description: 'Для сайтов с динамической подгрузкой' },
      // Placeholder for future LLM integration for Trip.com
      { title: '🤖 LLM (Not implemented)', value: 'llm-list', disabled: true },
    ]
  }

  const methodResponse = await prompts({
    type: 'select',
    name: 'fullMethod',
    message: 'Выберите метод скрапинга:',
    choices: methodChoices,
  })

  if (!methodResponse.fullMethod)
    return

  // Parse category and specific method
  const [category, ...methodParts] = methodResponse.fullMethod.split('-')
  const method = methodParts.join('-')

  // Step 3: Additional Options
  const cliOptions: { pages?: number } = {}

  const isListMethod = method === 'list' || ['puppeteer', 'playwright'].includes(method)

  if (isListMethod) {
    // Используем type: 'text' вместо 'number' чтобы избежать багов ввода в консоли
    const pagesResponse = await prompts({
      type: 'text',
      name: 'pages',
      message: 'Сколько страниц обработать? (Введите число)',
      initial: '1',
      validate: value => !Number.isNaN(Number.parseInt(value)) && Number.parseInt(value) > 0 ? true : 'Пожалуйста, введите корректное число больше 0',
    })

    // Преобразуем строку в число
    cliOptions.pages = Number.parseInt(pagesResponse.pages || '1', 10)
  }

  // Execute
  const runOptions: RunOptions = {
    provider: providerResponse.provider,
    category: category as 'llm' | 'classic',
    method,
    cliOptions,
  }

  await runScraper(runOptions)
}

main().catch((error) => {
  console.error('Произошла непредвиденная ошибка в CLI:', error)
})
