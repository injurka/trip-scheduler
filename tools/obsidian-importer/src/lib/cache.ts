import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = resolve(__dirname, '../../.cache')
const GEOCODE_CACHE_FILE = join(CACHE_DIR, 'geocode-cache.json')
const UPLOAD_CACHE_FILE = join(CACHE_DIR, 'upload-cache.json')

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

export function loadUploadCache(): Map<string, string> {
  try {
    if (existsSync(UPLOAD_CACHE_FILE)) {
      const raw = readFileSync(UPLOAD_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed).filter(
          ([, v]) => typeof v === 'string',
        ) as Array<[string, string]>
        return new Map(entries)
      }
    }
  }
  catch (err: any) {
    console.warn(`[Cache] Предупреждение: не удалось прочитать кеш загрузки фото: ${err.message}`)
  }
  return new Map()
}

export function saveUploadCache(cache: Map<string, string>): void {
  try {
    ensureCacheDir()
    const obj = Object.fromEntries(cache)
    writeFileSync(UPLOAD_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  catch (err: any) {
    console.warn(`[Cache] Ошибка сохранения кеша фото: ${err.message}`)
  }
}
