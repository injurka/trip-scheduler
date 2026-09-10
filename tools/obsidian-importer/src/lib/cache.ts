import type { ActivityPayload } from '../types'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = resolve(__dirname, '../../.cache')
const GEOCODE_CACHE_FILE = join(CACHE_DIR, 'geocode-cache.json')
const LLM_CACHE_FILE = join(CACHE_DIR, 'llm-cache.json')

export const LLM_PROMPT_VERSION = 'v1'

export function computeDayLlmHash(content: string, modelName: string = 'default'): string {
  return createHash('sha256')
    .update(`${LLM_PROMPT_VERSION}::${modelName.trim()}::${content.trim()}`)
    .digest('hex')
}

export interface LlmCacheEntry {
  date: string
  model: string
  activities: ActivityPayload[]
}

function ensureCacheDir(): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }
  }
  catch {
    // ignore filesystem errors
  }
}

export function loadGeocodeCache(): Map<string, [number, number]> {
  try {
    if (existsSync(GEOCODE_CACHE_FILE)) {
      const raw = readFileSync(GEOCODE_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed).filter(
          ([, v]) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number',
        ) as Array<[string, [number, number]]>
        return new Map(entries)
      }
    }
  }
  catch (err: any) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш геокодирования: ${err.message}`)
  }
  return new Map()
}

export function saveGeocodeCache(cache: Map<string, [number, number]>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err: any) {
    console.warn(`[Cache] Ошибка сохранения кеша геокодирования: ${err.message}`)
  }
}

export function loadLlmCache(): Map<string, LlmCacheEntry> {
  try {
    if (existsSync(LLM_CACHE_FILE)) {
      const raw = readFileSync(LLM_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed).filter(
          ([, v]: any) => v && Array.isArray(v.activities),
        ) as Array<[string, LlmCacheEntry]>
        return new Map(entries)
      }
    }
  }
  catch (err: any) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш ИИ: ${err.message}`)
  }
  return new Map()
}

export function saveLlmCache(cache: Map<string, LlmCacheEntry>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(LLM_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err: any) {
    console.warn(`[Cache] Ошибка сохранения кеша ИИ: ${err.message}`)
  }
}
