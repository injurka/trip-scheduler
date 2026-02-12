/* eslint-disable no-console */
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { getIcons } from '@iconify/utils'

const require = createRequire(import.meta.url)

const SOURCE_DIR = path.resolve(__dirname, '../src/renderer')
const OUTPUT_FILE = path.resolve(__dirname, '../src/renderer/assets/icons-bundle.json')

const ICON_REGEX = /\bmdi:[\w-]+/g

async function scanFiles(dir: string): Promise<string[]> {
  const icons = new Set<string>()
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const subIcons = await scanFiles(fullPath)
      subIcons.forEach(i => icons.add(i))
    }
    else if (entry.isFile() && /\.(?:vue|ts|js|json)$/.test(entry.name)) {
      const content = await fs.readFile(fullPath, 'utf-8')
      const matches = content.match(ICON_REGEX)
      if (matches) {
        matches.forEach(match => icons.add(match.replace('mdi:', '')))
      }
    }
  }

  return Array.from(icons)
}

async function bundle() {
  console.log('🔍 Сканирование иконок...')
  const usedIcons = await scanFiles(SOURCE_DIR)

  if (usedIcons.length === 0) {
    console.warn('⚠️ Иконки не найдены. Проверьте путь сканирования или префикс.')
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({ prefix: 'mdi', icons: {} }))
    return
  }

  console.log(`✨ Найдено ${usedIcons.length} уникальных иконок.`)

  try {
    const mdiJsonPath = require.resolve('@iconify-json/mdi/icons.json')

    const mdiJsonContent = await fs.readFile(mdiJsonPath, 'utf-8')
    const fullCollection = JSON.parse(mdiJsonContent)
    const filteredCollection = getIcons(fullCollection, usedIcons)

    if (!filteredCollection) {
      throw new Error('Не удалось создать подборку иконок.')
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredCollection))
    console.log(`✅ Бандл иконок успешно создан: ${OUTPUT_FILE}`)
  }
  catch (error) {
    console.error('❌ Ошибка при сборке иконок:')
    if (error instanceof Error && (error as any).code === 'MODULE_NOT_FOUND') {
      console.error('   Пакет @iconify-json/mdi не найден. Установите его: bun add -D @iconify-json/mdi')
    }
    else {
      console.error(error)
    }
    process.exit(1)
  }
}

bundle().catch((err) => {
  console.error(err)
  process.exit(1)
})
