/* eslint-disable no-console */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../../..')
const WORKER_ENTRY = path.resolve(ROOT_DIR, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs')
const OUTPUT_FILE = path.resolve(__dirname, '../public/maplibre-gl-worker.js')

async function bundleMaplibreWorker() {
  console.log('🗺️  Сборка автономного IIFE Web Worker для MapLibre GL...')

  try {
    const buildResult = await Bun.build({
      entrypoints: [WORKER_ENTRY],
      target: 'browser',
      format: 'iife',
      minify: true,
    })

    if (!buildResult.success) {
      console.error('❌ Ошибка сборки maplibre worker:', buildResult.logs)
      process.exit(1)
    }

    const artifact = buildResult.outputs[0]
    const code = await artifact.text()

    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
    await fs.writeFile(OUTPUT_FILE, code, 'utf-8')
    console.log(`✅ maplibre-gl-worker.js успешно собран (${(code.length / 1024).toFixed(1)} KB) -> ${OUTPUT_FILE}`)
  }
  catch (error) {
    console.error('❌ Исключение при сборке maplibre worker:', error)
    process.exit(1)
  }
}

void bundleMaplibreWorker()
