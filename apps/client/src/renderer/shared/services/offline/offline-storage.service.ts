import type { OfflineTripEntry } from '~/shared/store/offline.store'

/**
 * Сервис хранения офлайн-путешествий в IndexedDB.
 * Решает проблему лимита 5 МБ в window.localStorage.
 * При первом запуске прозрачно мигрирует старые данные из localStorage.
 */

const DB_NAME = 'trip-scheduler-offline-trips-db'
const DB_VERSION = 1
const STORE_NAME = 'trips'
const LEGACY_STORAGE_KEY = 'offline-trips-data'

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null

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
            db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          console.warn('[OfflineStorageService] Не удалось открыть IndexedDB:', req.error)
          resolve(null)
        }
      }
      catch (e) {
        console.warn('[OfflineStorageService] Ошибка инициализации IndexedDB:', e)
        resolve(null)
      }
    })

    return this.dbPromise
  }

  /**
   * Загрузка всех сохраненных путешествий с автоматической миграцией из localStorage
   */
  public async loadAllTrips(): Promise<Record<string, OfflineTripEntry>> {
    const db = await this.getDB()
    const result: Record<string, OfflineTripEntry> = {}

    // 1. Попытка прочитать из IndexedDB
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const store = tx.objectStore(STORE_NAME)
          const req = store.getAll()
          req.onsuccess = () => {
            const list: OfflineTripEntry[] = req.result || []
            list.forEach((item) => {
              if (item?.id) {
                result[item.id] = item
              }
            })
            resolve()
          }
          req.onerror = () => resolve()
        }
        catch {
          resolve()
        }
      })
    }

    // 2. Если в IndexedDB пусто, проверяем legacy localStorage и мигрируем
    if (Object.keys(result).length === 0 && typeof localStorage !== 'undefined') {
      try {
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw) as Record<string, OfflineTripEntry>
          if (parsed && typeof parsed === 'object') {
            for (const [id, entry] of Object.entries(parsed)) {
              result[id] = entry
              // Сохраняем в IndexedDB
              await this.saveTrip(entry)
            }
            // Очищаем localStorage, освобождая системную квоту 5 МБ
            localStorage.removeItem(LEGACY_STORAGE_KEY)
          }
        }
      }
      catch (e) {
        console.warn('[OfflineStorageService] Ошибка при миграции из localStorage:', e)
      }
    }

    return result
  }

  /**
   * Сохранение путешествия в IndexedDB (с фоллбеком в localStorage, если IDB недоступен)
   */
  public async saveTrip(entry: OfflineTripEntry): Promise<void> {
    const db = await this.getDB()
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.put(entry)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        }
        catch (e) {
          reject(e)
        }
      })
      return
    }

    // Fallback: localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        const current = raw ? JSON.parse(raw) : {}
        current[entry.id] = entry
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(current))
      }
      catch (e) {
        console.warn('[OfflineStorageService] Fallback localStorage failed:', e)
      }
    }
  }

  /**
   * Удаление путешествия из хранилища
   */
  public async removeTrip(tripId: string): Promise<void> {
    const db = await this.getDB()
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.delete(tripId)
          req.onsuccess = () => resolve()
          req.onerror = () => resolve()
        }
        catch {
          resolve()
        }
      })
      return
    }

    // Fallback: localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (raw) {
          const current = JSON.parse(raw)
          delete current[tripId]
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(current))
        }
      }
      catch {}
    }
  }
}

export const offlineStorageService = new OfflineStorageService()
