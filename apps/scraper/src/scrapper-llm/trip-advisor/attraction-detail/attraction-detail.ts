/* eslint-disable no-console */
import type { AttractionListItem } from '../attractions-list/attractions-list.schema'
import type { AttractionDetail } from './attraction-detail.schema'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { createAiChatRequest } from '~/lib/llm'
import { ARTIFACTS_DIR } from '../config'
import { getDetailPrompt } from './attraction-detail.prompt'
import { AttractionDetailSchema } from './attraction-detail.schema'

async function scrapeSingleDetailPage(url: string): Promise<AttractionDetail | null> {
  console.log(`[LLM-DETAIL] Отправка запроса для URL: ${url}`)
  const prompt = {
    system: 'You are an expert web scraper. Your task is to fetch content from a URL, extract structured data, and return it as a single JSON object.',
    user: getDetailPrompt(url),
  }

  try {
    const response = await createAiChatRequest(prompt, { model: 'gemini-2.5-pro' })
    const jsonContent = response.choices[0]?.message?.content
    if (!jsonContent)
      throw new Error('LLM не вернул контент.')

    const cleanedJson = jsonContent.replace(/```json\n|```/g, '').trim()
    const parsedData = JSON.parse(cleanedJson)
    return AttractionDetailSchema.parse(parsedData)
  }
  catch (error) {
    console.error(`[LLM-DETAIL] Ошибка при скрапинге деталей по URL ${url}:`, error)
    if (error instanceof z.ZodError)
      console.error('Ошибки валидации Zod:', error)
    return null
  }
}

export async function runAttractionDetailScraping(options: { city: string, maxDetails: number }) {
  const { city, maxDetails } = options
  const inputFile = path.join(ARTIFACTS_DIR, `${city.toLowerCase()}-attractions-list.json`)

  let attractions: AttractionListItem[]
  try {
    const fileContent = await fs.readFile(inputFile, 'utf-8')
    attractions = JSON.parse(fileContent)
  }
  catch {
    console.error(`[LLM-DETAIL] Не удалось прочитать файл с входными данными: ${inputFile}`)
    console.error('[LLM-DETAIL] Пожалуйста, сначала запустите этап "Сбор списков достопримечательностей".')
    return
  }

  const attractionsToDetail = attractions.slice(0, maxDetails)
  console.log(`[LLM-DETAIL] Этап 2 запущен. Будет собрана информация для ${attractionsToDetail.length} из ${attractions.length} достопримечательностей.`)

  const detailedResults: AttractionDetail[] = []
  for (const item of attractionsToDetail) {
    if (!item.url) {
      console.warn(`[LLM-DETAIL] Пропуск элемента без URL: ${item.location_name}`)
      continue
    }
    const details = await scrapeSingleDetailPage(item.url)
    if (details)
      detailedResults.push(details)
  }

  console.log(`[LLM-DETAIL] Этап 2 завершен. Собраны детали для ${detailedResults.length} достопримечательностей.`)

  if (detailedResults.length > 0) {
    await fs.mkdir(ARTIFACTS_DIR, { recursive: true })
    const filePath = path.join(ARTIFACTS_DIR, `${city.toLowerCase()}-attractions-details.json`)
    await fs.writeFile(filePath, JSON.stringify(detailedResults, null, 2))
    console.log(`[LLM-DETAIL] Результаты сохранены в файл: ${filePath}`)
  }
}
