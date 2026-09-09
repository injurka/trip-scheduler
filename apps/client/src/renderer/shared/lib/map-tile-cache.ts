import type { RequestParameters, ResourceType } from 'maplibre-gl'
import { isMobileApp } from '~/shared/lib/env'

/**
 * Высокопроизводительный и надежный кэш тайлов/ресурсов MapTiler для мобильного приложения Tauri (Android APK / iOS).
 *
 * Архитектура:
 * 1. Основное хранилище: Web Cache API (window.caches), поддерживаемое современным Android WebView.
 * 2. Метаданные и LRU-вытеснение: IndexedDB (отслеживает accessedAt каждого URL).
 * 3. Дедупликация in-flight запросов: предотвращает параллельные повторные fetch-запросы на один и тот же тайл при зуме/скролле.
 * 4. Управление памятью: отслеживание созданных Object URL и их отзыв через URL.revokeObjectURL при размонтировании/очистке.
 * 5. Изоляция: работает исключительно когда `isMobileApp === true`. Для веба и десктопа оверхед равен нулю.
 */

const CACHE_NAME = 'trip-scheduler-maptiler-apk-v1'
const DB_NAME = 'trip-scheduler-tile-cache-db'
const DB_VERSION = 1
const STORE_NAME = 'tile-meta'

// Хранить кэш тайлов 30 дней
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
// Максимальное количество ресурсов в кэше мобильного устройства (2500 тайлов ~60-90 MB)
const MAX_ENTRIES = 2500

interface TileMeta {
  url: string
  accessedAt: number
}

class MapTileCacheManager {
  private dbPromise: Promise<IDBDatabase | null> | null = null
  private cleanupScheduled = false
  private inFlightRequests = new Map<string, Promise<string>>()
  private activeBlobUrls = new Set<string>()

  private getDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise)
      return this.dbPromise

    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null)
      return this.dbPromise
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })
            store.createIndex('accessedAt', 'accessedAt', { unique: false })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          console.warn('[MapTileCache] Ошибка открытия IndexedDB:', req.error)
          resolve(null)
        }
      }
      catch (e) {
        console.warn('[MapTileCache] Исключение при открытии IndexedDB:', e)
        resolve(null)
      }
    })

    return this.dbPromise
  }

  private async recordAccess(url: string): Promise<void> {
    const db = await this.getDB()
    if (!db)
      return

    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        url,
        accessedAt: Date.now(),
      } satisfies TileMeta)
    }
    catch {
      // Фоновое обновление метаданных не должно ломать рендер
    }
  }

  /**
   * Фоновая очистка устаревших (TTL) и наименее востребованных (LRU) ресурсов
   */
  public scheduleCleanup(): void {
    if (this.cleanupScheduled)
      return
    this.cleanupScheduled = true

    // Задержка очистки, чтобы не создавать нагрузку на I/O во время активной отрисовки карты
    setTimeout(async () => {
      try {
        await this.performCleanup()
      }
      catch (e) {
        console.warn('[MapTileCache] Ошибка при фоновой очистке кэша:', e)
      }
      finally {
        this.cleanupScheduled = false
      }
    }, 15000)
  }

  private async performCleanup(): Promise<void> {
    if (typeof caches === 'undefined')
      return

    const db = await this.getDB()
    if (!db)
      return

    const cache = await caches.open(CACHE_NAME)
    const now = Date.now()

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const index = store.index('accessedAt')
        const req = index.getAll()

        req.onsuccess = async () => {
          const records: TileMeta[] = req.result || []
          if (!records.length) {
            resolve()
            return
          }

          const expiredUrls: string[] = []
          const validRecords: TileMeta[] = []

          for (const rec of records) {
            if (now - rec.accessedAt > MAX_AGE_MS) {
              expiredUrls.push(rec.url)
            }
            else {
              validRecords.push(rec)
            }
          }

          // LRU вытеснение сверх лимита
          if (validRecords.length > MAX_ENTRIES) {
            validRecords.sort((a, b) => a.accessedAt - b.accessedAt)
            const countToRemove = validRecords.length - MAX_ENTRIES
            for (let i = 0; i < countToRemove; i++) {
              expiredUrls.push(validRecords[i].url)
            }
          }

          if (expiredUrls.length > 0) {
            const deleteTx = db.transaction(STORE_NAME, 'readwrite')
            const deleteStore = deleteTx.objectStore(STORE_NAME)

            for (const url of expiredUrls) {
              deleteStore.delete(url)
              cache.delete(url).catch(() => {})
            }
          }

          resolve()
        }

        req.onerror = () => resolve()
      }
      catch {
        resolve()
      }
    })
  }

  /**
   * Загрузка или получение ресурса MapTiler из CacheStorage с дедупликацией параллельных запросов.
   */
  public async getCachedBlobUrl(url: string): Promise<string> {
    if (typeof caches === 'undefined') {
      return url
    }

    // Если прямо сейчас этот же URL уже загружается — используем общий Promise
    const inFlight = this.inFlightRequests.get(url)
    if (inFlight) {
      return inFlight
    }

    const fetchPromise = (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        const cachedResponse = await cache.match(url)

        if (cachedResponse) {
          void this.recordAccess(url)
          this.scheduleCleanup()

          const blob = await cachedResponse.blob()
          const blobUrl = URL.createObjectURL(blob)
          this.activeBlobUrls.add(blobUrl)
          return blobUrl
        }

        // Сетевой запрос при промахе кэша
        const networkResponse = await fetch(url)
        if (networkResponse.ok) {
          // Кэшируем только успешные ответы (200 OK)
          await cache.put(url, networkResponse.clone())
          void this.recordAccess(url)
          this.scheduleCleanup()

          const blob = await networkResponse.blob()
          const blobUrl = URL.createObjectURL(blob)
          this.activeBlobUrls.add(blobUrl)
          return blobUrl
        }

        return url
      }
      catch (e) {
        console.warn('[MapTileCache] Сбой при кэшировании тайла, возврат на оригинальный URL:', e)
        return url
      }
      finally {
        this.inFlightRequests.delete(url)
      }
    })()

    this.inFlightRequests.set(url, fetchPromise)
    return fetchPromise
  }

  /**
   * Предзагрузка массива URL (тайлов, спрайтов, стилей) в кэш
   */
  public async precacheUrls(
    urls: string[],
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    if (typeof caches === 'undefined' || urls.length === 0)
      return

    const cache = await caches.open(CACHE_NAME)
    const BATCH_SIZE = 6
    let loaded = 0

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (url) => {
          try {
            const hasMatch = await cache.match(url)
            if (!hasMatch) {
              const res = await fetch(url)
              if (res.ok) {
                await cache.put(url, res)
                void this.recordAccess(url)
              }
            }
          }
          catch {
            // Игнорируем сетевые ошибки для отдельных тайлов
          }
          finally {
            loaded++
            onProgress?.(loaded, urls.length)
          }
        }),
      )
    }

    this.scheduleCleanup()
  }

  /**
   * Освобождение Blob URL из оперативной памяти браузера
   */
  public releaseBlobUrls(): void {
    for (const blobUrl of this.activeBlobUrls) {
      URL.revokeObjectURL(blobUrl)
    }
    this.activeBlobUrls.clear()
  }
}

export const mapTileCacheManager = new MapTileCacheManager()

/**
 * Создаёт хук transformRequest для MapLibre GL.
 * Активируется ТОЛЬКО в мобильном приложении Tauri (isMobileApp).
 */
export function getMaplibreTransformRequest(): ((url: string, resourceType?: ResourceType) => Promise<RequestParameters> | RequestParameters) | undefined {
  if (!isMobileApp) {
    return undefined
  }

  return (url: string) => {
    // Перехватываем только запросы к API MapTiler
    if (!url.includes('api.maptiler.com')) {
      return { url }
    }

    // Служебные запросы tiles.json не кэшируем в BLOB во избежание проблем со ссылками
    if (url.includes('/tiles.json')) {
      return { url }
    }

    return (async () => {
      const blobUrl = await mapTileCacheManager.getCachedBlobUrl(url)
      return { url: blobUrl }
    })()
  }
}
