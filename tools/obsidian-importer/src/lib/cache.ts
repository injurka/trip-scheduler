import type { ActivityPayload } from '../types'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getErrorMessage, isRecord } from './value-guards'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = resolve(__dirname, '../../.cache')
const GEOCODE_CACHE_FILE = join(CACHE_DIR, 'geocode-cache.json')
const LLM_CACHE_FILE = join(CACHE_DIR, 'llm-cache.json')
const IMAGE_CACHE_FILE = join(CACHE_DIR, 'image-upload-cache.json')

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
  catch (err) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш геокодирования: ${getErrorMessage(err)}`)
  }
  return new Map()
}

export function saveGeocodeCache(cache: Map<string, [number, number]>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err) {
    console.warn(`[Cache] Ошибка сохранения кеша геокодирования: ${getErrorMessage(err)}`)
  }
}

export function loadLlmCache(): Map<string, LlmCacheEntry> {
  try {
    if (existsSync(LLM_CACHE_FILE)) {
      const raw = readFileSync(LLM_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed).filter(
          ([, v]) => isRecord(v) && Array.isArray(v.activities),
        ) as Array<[string, LlmCacheEntry]>
        return new Map(entries)
      }
    }
  }
  catch (err) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш ИИ: ${getErrorMessage(err)}`)
  }
  return new Map()
}

export function saveLlmCache(cache: Map<string, LlmCacheEntry>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(LLM_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err) {
    console.warn(`[Cache] Ошибка сохранения кеша ИИ: ${getErrorMessage(err)}`)
  }
}

export interface ImageCacheEntry {
  url: string
  size: number
  mtimeMs: number
  tripId: string
  uploadedAt: string
}

export function getImageCacheKey(tripId: string, filePath: string): string {
  return `${tripId}::${filePath}`
}

export function loadImageUploadCache(): Map<string, ImageCacheEntry> {
  try {
    if (existsSync(IMAGE_CACHE_FILE)) {
      const raw = readFileSync(IMAGE_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed).filter(
          ([, v]) => isRecord(v) && typeof v.url === 'string' && typeof v.size === 'number' && typeof v.tripId === 'string',
        ) as Array<[string, ImageCacheEntry]>
        return new Map(entries)
      }
    }
  }
  catch (err) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш загрузки картинок: ${getErrorMessage(err)}`)
  }
  return new Map()
}

export function saveImageUploadCache(cache: Map<string, ImageCacheEntry>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(IMAGE_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err) {
    console.warn(`[Cache] Ошибка сохранения кеша картинок: ${getErrorMessage(err)}`)
  }
}

export function lookupImageCache(
  tripId: string,
  filePath: string,
  cache: Map<string, ImageCacheEntry>,
): string | null {
  try {
    if (!existsSync(filePath))
      return null
    const stat = statSync(filePath)
    const key = getImageCacheKey(tripId, filePath)
    const entry = cache.get(key)
    if (entry && entry.tripId === tripId && entry.size === stat.size && Math.abs(entry.mtimeMs - stat.mtimeMs) < 1000) {
      return entry.url
    }
  }
  catch {
    return null
  }
  return null
}

export function setImageCache(
  tripId: string,
  filePath: string,
  url: string,
  cache: Map<string, ImageCacheEntry>,
): void {
  try {
    if (!existsSync(filePath))
      return
    const stat = statSync(filePath)
    const key = getImageCacheKey(tripId, filePath)
    cache.set(key, {
      url,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      tripId,
      uploadedAt: new Date().toISOString(),
    })
  }
  catch {
    // ignore filesystem errors
  }
}
