import type { LocationInfo } from './types.js'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import pc from 'picocolors'
import { TravelAgent } from './lib/agent.js'
import { BrowserService } from './lib/browser.js'
import { config } from './lib/config.js'
import { downloadImage, getGlobalCache, saveGlobalCache, saveLocationData } from './lib/helpers.js'

const TARGET_FILE = config.paths.targetFile
const OUTPUT_DIR = config.paths.outputDir

async function main() {
  if (!TARGET_FILE || !OUTPUT_DIR) {
    console.error(pc.red('❌ Ошибка: Не заданы targetFile или outputDir в config.json'))
    process.exit(1)
  }

  if (!fs.existsSync(TARGET_FILE)) {
    console.error(pc.red(`Файл не найден: ${TARGET_FILE}`))
    return
  }

  const originalMarkdown = await fsPromises.readFile(TARGET_FILE, 'utf-8')
  const fileName = path.basename(TARGET_FILE)

  const dayMatch = fileName.match(/\b(?:day)?[-_ ]?(\d{1,2})\b/i)
  const dayNumber = dayMatch ? dayMatch[1].padStart(2, '0') : '00'

  const browser = new BrowserService()

  const GLOBAL_CACHE_PATH = path.join(OUTPUT_DIR, 'global_locations_cache.json')

  let agent: TravelAgent | undefined

  try {
    await browser.init()
    agent = new TravelAgent(browser)

    const tasks = await agent.extractTasks(originalMarkdown, dayNumber)
    console.log(pc.green(`✅ Найдено активностей для поиска: ${tasks.length}`))
    tasks.forEach(t => console.log(pc.gray(` - ${t.locationName} (${t.cityName})`)))

    const collectedData: LocationInfo[] = []

    for (const task of tasks) {
      const cacheKey = `${task.cityName}_${task.locationName}`.toLowerCase().replace(/\s+/g, '_')

      const cachedData = await getGlobalCache(GLOBAL_CACHE_PATH, cacheKey)
      if (cachedData) {
        console.log(pc.green(`\n♻️  Найдено в глобальном кэше: ${task.locationName} (${task.cityName}). Пропускаю поиск.`))
        collectedData.push(cachedData)
        await saveLocationData(task.dayNumber, cachedData, OUTPUT_DIR)
        continue
      }

      const result = await agent.researchLocation(task)

      if (result) {
        const imagePromises = result.imageUrls.map((url, i) =>
          downloadImage(url, task.dayNumber, i, task.locationName, OUTPUT_DIR),
        )

        const downloadedImages = await Promise.all(imagePromises)
        const localImageNames = downloadedImages.filter(name => name !== '')

        const finalData: LocationInfo = {
          ...result,
          localImages: localImageNames,
        }

        await saveLocationData(task.dayNumber, finalData, OUTPUT_DIR)
        await saveGlobalCache(GLOBAL_CACHE_PATH, cacheKey, finalData)

        collectedData.push(finalData)
      }
    }

    if (collectedData.length > 0) {
      const newMarkdown = await agent.enrichMarkdown(originalMarkdown, collectedData)

      const newFileName = fileName.replace('.md', ' ⭐.md')
      const newFilePath = path.join(path.dirname(TARGET_FILE), newFileName)
      await fsPromises.writeFile(newFilePath, newMarkdown, 'utf-8')

      console.log(pc.bgGreen(pc.white(`\n🎉 Итоговый файл успешно сохранен: ${newFilePath}`)))
    }
    else {
      console.log(pc.yellow('\n⚠ Не удалось собрать данные. Файл не был обновлен.'))
    }
  }
  catch (error) {
    console.error(pc.red('Критическая ошибка выполнения:'), error)
  }
  finally {
    await browser.close()
    console.log(pc.gray('Браузер успешно закрыт.'))

    if (agent && Object.keys(agent.tokenUsage).length > 0) {
      console.log(pc.yellow('\n📊 Статистика использования токенов API:'))
      let totalCost = 0

      const pricingConfig = config.pricing

      for (const [model, stats] of Object.entries(agent.tokenUsage)) {
        console.log(pc.cyan(` 🔹 Модель: ${model}`))
        console.log(pc.cyan(`    - Prompt (входящие): ${stats.prompt}`))
        console.log(pc.cyan(`    - Completion (генерация): ${stats.completion}`))
        console.log(pc.cyan(`    - Total (всего): ${stats.total}`))

        let cost = 0

        const matchedKey = Object.keys(pricingConfig).find(k => model.includes(k))

        if (matchedKey) {
          const rates = pricingConfig[matchedKey]
          if (rates.total !== undefined) {
            cost = (stats.total / 1_000_000) * rates.total
          }
          else {
            cost = (stats.prompt / 1_000_000) * (rates.prompt || 0) + (stats.completion / 1_000_000) * (rates.completion || 0)
          }
        }

        if (cost > 0) {
          console.log(pc.green(`    - Примерная стоимость: $${cost.toFixed(6)}`))
          totalCost += cost
        }
        else if (!matchedKey) {
          console.log(pc.gray(`    - Нет цены в config.json для модели "${model}"`))
        }
      }

      if (totalCost > 0) {
        console.log(pc.bgGreen(pc.black(`\n 💰 Общая примерная стоимость сессии: $${totalCost.toFixed(6)} `)))
      }
    }
  }
}

main().catch(console.error)
