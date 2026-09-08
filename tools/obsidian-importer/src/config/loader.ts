import type { ImporterConfig } from '../types'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  AIHUBMIX_MODELS,
  DEFAULT_AIHUBMIX_MODEL,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_GEOCODING_SETTINGS,
  DEFAULT_TRIP_SECTIONS,
} from './constants'

export function getBuiltinDefaultConfig(): ImporterConfig {
  return {
    defaultModel: DEFAULT_AIHUBMIX_MODEL,
    models: [...AIHUBMIX_MODELS],
    mainCurrency: 'RUB',
    exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
    defaultSections: [...DEFAULT_TRIP_SECTIONS],
    batchSize: 8,
    llmTimeoutMs: 45000,
    geocoding: { ...DEFAULT_GEOCODING_SETTINGS },
  }
}

let activeConfig: ImporterConfig = getBuiltinDefaultConfig()

export function loadImporterConfig(customPath?: string): ImporterConfig {
  const candidatePaths: string[] = []

  if (customPath) {
    candidatePaths.push(resolve(process.cwd(), customPath))
  }

  // Common default lookup locations:
  // 1. Current working directory
  candidatePaths.push(resolve(process.cwd(), 'importer.config.json'))
  // 2. Relative to tool directory
  candidatePaths.push(resolve(import.meta.dir, '../../importer.config.json'))
  // 3. Root of trip-scheduler repo if running from within monorepo
  candidatePaths.push(resolve(process.cwd(), 'tools/obsidian-importer/importer.config.json'))

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8')
        const parsed = JSON.parse(raw)
        activeConfig = {
          defaultModel: parsed.defaultModel || DEFAULT_AIHUBMIX_MODEL,
          models: Array.isArray(parsed.models) && parsed.models.length > 0 ? parsed.models : [...AIHUBMIX_MODELS],
          mainCurrency: parsed.mainCurrency || 'RUB',
          exchangeRates: parsed.exchangeRates ? { ...DEFAULT_EXCHANGE_RATES, ...parsed.exchangeRates } : { ...DEFAULT_EXCHANGE_RATES },
          defaultSections: Array.isArray(parsed.defaultSections) && parsed.defaultSections.length > 0 ? parsed.defaultSections : [...DEFAULT_TRIP_SECTIONS],
          batchSize: typeof parsed.batchSize === 'number' ? parsed.batchSize : 8,
          llmTimeoutMs: typeof parsed.llmTimeoutMs === 'number' ? parsed.llmTimeoutMs : 45000,
          geocoding: {
            ...DEFAULT_GEOCODING_SETTINGS,
            ...(parsed.geocoding || {}),
          },
        }
        return activeConfig
      }
      catch (err: any) {
        console.warn(`[Config] Предупреждение: не удалось прочитать конфиг ${p}: ${err.message}`)
      }
    }
  }

  activeConfig = getBuiltinDefaultConfig()
  return activeConfig
}

export function getConfig(): ImporterConfig {
  return activeConfig
}
