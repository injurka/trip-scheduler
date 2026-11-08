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

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false

  const err = error as { name?: string, code?: number, message?: string }

  return err.name === 'QuotaExceededError'
    || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || err.code === 22
    || err.code === 1014
    || (typeof err.message === 'string' && /quota|storage.*full|недостаточно.*мест/i.test(err.message))
}

function createQuotaExceededError(): Error {
  const error = new Error('Недостаточно свободного места на устройстве для сохранения офлайн-пакета. Освободите память и попробуйте снова.')
  error.name = 'QuotaExceededError'

  return error
}

function belongsToAccount(entry: OfflineTripEntry, accountId: string | null | undefined) {
  return accountId === undefined || (entry.downloadedByUserId ?? entry.data?.userId) === accountId
}

export class OfflineStorageService {
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

  private async readEntries(db: IDBDatabase | null): Promise<Record<string, OfflineTripEntry>> {
    if (!db)
      return {}

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(Object.fromEntries((request.result as OfflineTripEntry[]).map(entry => [entry.id, entry])))
      request.onerror = () => reject(request.error)
    })
  }

  private async mergeLegacy(db: IDBDatabase | null, entries: Record<string, OfflineTripEntry>) {
    if (typeof localStorage === 'undefined')
      return

    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)

    if (!raw)
      return

    const legacy = JSON.parse(raw) as Record<string, OfflineTripEntry>

    for (const [key, entry] of Object.entries(legacy)) {
      if (entries[key])
        continue

      entries[key] = entry

      if (db)
        await this.saveTrip(entry)
    }

    // With no IndexedDB this remains the primary store, not a migration source.
    if (db)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  public async loadAllTrips(accountId?: string | null): Promise<Record<string, OfflineTripEntry>> {
    const db = await this.getDB()
    const entries = await this.readEntries(db)
    await this.mergeLegacy(db, entries)
    const result: Record<string, OfflineTripEntry> = {}

    for (const entry of Object.values(entries)) {
      if (!belongsToAccount(entry, accountId))
        continue

      const tripId = entry.data?.id ?? entry.id

      // Prefer scoped records over pre-migration copies of the same trip.
      if (!result[tripId]?.downloadedByUserId || entry.downloadedByUserId)
        result[tripId] = { ...entry, id: tripId }
    }

    return result
  }

  /**
   * Сохранение путешествия в IndexedDB (с фоллбеком в localStorage, если IDB недоступен)
   */
  public async saveTrip(entry: OfflineTripEntry): Promise<void> {
    const db = await this.getDB()
    const stored = { ...entry, id: entry.downloadedByUserId ? `${entry.downloadedByUserId}:${entry.id}` : entry.id }

    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          try {
            const tx = db.transaction(STORE_NAME, 'readwrite')
            const store = tx.objectStore(STORE_NAME)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error ?? new Error('IndexedDB save transaction failed'))
            tx.onabort = () => reject(tx.error ?? new Error('IndexedDB save transaction aborted'))
            store.put(stored)
          }
          catch (e) {
            reject(e)
          }
        })
      }
      catch (e) {
        if (isQuotaExceededError(e))
          throw createQuotaExceededError()

        throw e
      }

      return
    }

    // Fallback: localStorage
    if (typeof localStorage === 'undefined') {
      throw new Error('IndexedDB and localStorage are unavailable')
    }

    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
      const current = raw ? JSON.parse(raw) : {}
      current[stored.id] = stored
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(current))
    }
    catch (e) {
      console.warn('[OfflineStorageService] Fallback localStorage failed:', e)

      if (isQuotaExceededError(e))
        throw createQuotaExceededError()

      throw e
    }
  }

  /**
   * Удаление путешествия из хранилища
   */
  public async removeTrip(tripId: string, accountId?: string | null): Promise<void> {
    const db = await this.getDB()

    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete transaction failed'))
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete transaction aborted'))
          store.delete(accountId ? `${accountId}:${tripId}` : tripId)

          if (accountId) {
            const legacy = store.get(tripId)
            legacy.onsuccess = () => {
              if (legacy.result && belongsToAccount(legacy.result, accountId))
                store.delete(tripId)
            }
          }
        }
        catch (e) {
          reject(e)
        }
      })

      return
    }

    // Fallback: localStorage
    if (typeof localStorage === 'undefined') {
      throw new Error('IndexedDB and localStorage are unavailable')
    }

    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY)

      if (raw) {
        const current = JSON.parse(raw)

        if (current[tripId] && belongsToAccount(current[tripId], accountId))
          delete current[tripId]

        if (accountId)
          delete current[`${accountId}:${tripId}`]

        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(current))
      }
    }
    catch (e) {
      console.warn('[OfflineStorageService] Fallback localStorage delete failed:', e)
      throw e
    }
  }
}

export const offlineStorageService = new OfflineStorageService()
