/* eslint-disable no-console */
import type { AttractionListItem } from './attractions-list.schema'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { createAiChatRequest } from '~/lib/llm'
import { ARTIFACTS_DIR, CITIES } from '../config'
import { getListPrompt } from './attractions-list.prompt'
import { AttractionListSchema } from './attractions-list.schema'

async function scrapeSingleListPage(city: string, url: string): Promise<AttractionListItem[]> {
  console.log(`[LLM-LIST] Отправка запроса для URL: ${url}`)
  const prompt = {
    system: 'You are an expert web scraper. Your task is to fetch content from a URL, extract structured data, and return it in JSON format. You must follow all instructions with extreme precision, especially regarding URL formats.',
    user: getListPrompt(city, url),
  }

  try {
    const response = await createAiChatRequest(prompt, { model: 'gemini-2.5-pro' })
    const jsonContent = response.choices[0]?.message?.content
    console.log('jsonContent', jsonContent)

    if (!jsonContent)
      throw new Error('LLM не вернул контент.')

    const cleanedJson = jsonContent.replace(/```json\n|```/g, '').trim()
    const parsedData = JSON.parse(cleanedJson)
    return AttractionListSchema.parse(parsedData)
  }
  catch (error) {
    console.error(`[LLM-LIST] Ошибка при скрапинге списка по URL ${url}:`, error)
    if (error instanceof z.ZodError)
      console.error('Ошибки валидации Zod:', error.issues)
    return []
  }
}

export async function runAttractionsListScraping(options: { city: string, pages: number }) {
  const { city, pages } = options
  const cityConfig = CITIES[city.toLowerCase() as keyof typeof CITIES]

  if (!cityConfig) {
    console.error(`[LLM-LIST] Конфигурация для города "${city}" не найдена.`)
    return
  }

  const allAttractions: AttractionListItem[] = []
  for (let i = 0; i < pages; i++) {
    const pageOffset = i * cityConfig.pageStep
    const url = `${cityConfig.listBaseUrl}${pageOffset}${cityConfig.suffix}`
    const attractions = await scrapeSingleListPage(cityConfig.name, url)
    allAttractions.push(...attractions)
  }

  console.log(`[LLM-LIST] Этап 1 завершен. Собрано ${allAttractions.length} достопримечательностей.`)

  if (allAttractions.length > 0) {
    await fs.mkdir(ARTIFACTS_DIR, { recursive: true })
    const filePath = path.join(ARTIFACTS_DIR, `${city.toLowerCase()}-attractions-list.json`)
    await fs.writeFile(filePath, JSON.stringify(allAttractions, null, 2))
    console.log(`[LLM-LIST] Результаты сохранены в файл: ${filePath}`)
  }
}
