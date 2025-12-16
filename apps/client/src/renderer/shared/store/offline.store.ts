import type { TripWithDays } from '~/shared/types/models/trip'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { OFFLINE_MEDIA_CACHE_NAME } from '~/service-worker/constant'
import { useToast } from '~/shared/composables/use-toast'

export interface OfflineTripEntry {
  id: string
  title: string
  savedAt: number // Timestamp
  imageCount: number
  data: TripWithDays // Полный слепок данных (JSON)
}

export interface IOfflineState {
  savedTrips: Record<string, OfflineTripEntry>
  isDownloading: Record<string, boolean> // id -> bool
  downloadProgress: Record<string, number> // id -> % (0-100)
}

export const useOfflineStore = defineStore('offline', {
  state: (): IOfflineState => ({
    // Сохраняем метаданные и JSON в LocalStorage
    savedTrips: useStorage<Record<string, OfflineTripEntry>>('offline-trips-data', {}).value,
    isDownloading: {},
    downloadProgress: {},
  }),

  getters: {
    isTripCached: state => (tripId: string) => !!state.savedTrips[tripId],
    getSavedTrip: state => (tripId: string) => state.savedTrips[tripId]?.data,
    sortedSavedTrips: (state) => {
      return Object.values(state.savedTrips).sort((a, b) => b.savedAt - a.savedAt)
    },
    getDownloadProgress: state => (tripId: string) => state.downloadProgress[tripId] || 0,
    isTripDownloading: state => (tripId: string) => !!state.isDownloading[tripId],
  },

  actions: {
    /**
     * Основная функция кэширования
     */
    async saveTripForOffline(trip: TripWithDays) {
      if (this.isDownloading[trip.id])
        return

      this.isDownloading[trip.id] = true
      this.downloadProgress[trip.id] = 0
      const toast = useToast()

      try {
        // 1. Собираем все URL картинок из объекта путешествия
        const urlsToCache = new Set<string>()

        // Функция-хелпер для проверки и добавления URL
        const addUrl = (url: string | null | undefined) => {
          if (!url)
            return
          // Игнорируем blob (локальные превью) и base64
          if (url.startsWith('blob:') || url.startsWith('data:'))
            return
          // ВАЖНО: Игнорируем картинки из секции memories (обычно их слишком много и они не критичны для маршрута)
          // Если нужно кэшировать и их - уберите это условие
          if (url.includes('/memories/'))
            return

          urlsToCache.add(url)
        }

        // --- Обход структуры данных ---

        // Обложка
        addUrl(trip.imageUrl)

        // Секции самого путешествия
        trip.sections.forEach((section: any) => {
          // Галерея
          if (section.type === 'gallery' && Array.isArray(section.content?.imageUrls)) {
            section.content.imageUrls.forEach(addUrl)
          }
          // Документы (если это картинки)
          if (section.type === 'documents' && Array.isArray(section.content?.documents)) {
            section.content.documents.forEach((doc: any) => {
              if (['jpg', 'jpeg', 'png', 'webp'].includes(doc.fileType?.toLowerCase())) {
                addUrl(doc.url)
              }
            })
          }
        })

        // Дни и Активности
        trip.days.forEach((day) => {
          day.activities.forEach((activity) => {
            activity.sections?.forEach((section: any) => {
              // Галерея внутри активности
              if (section.type === 'gallery' && Array.isArray(section.imageUrls)) {
                section.imageUrls.forEach(addUrl)
              }
              // Геолокация (картинки точек)
              if (section.type === 'geolocation') {
                if (Array.isArray(section.points)) {
                  section.points.forEach((point: any) => {
                    // Проверяем стиль и payload
                    if (point.imageUrl)
                      addUrl(point.imageUrl)
                    if (point.style?.iconUrl)
                      addUrl(point.style.iconUrl)
                  })
                }
              }
            })
          })
        })

        // 2. Работа с Cache API
        const cache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)
        const urlsArray = Array.from(urlsToCache)
        let loadedCount = 0

        // Если картинок нет, сразу ставим 100%
        if (urlsArray.length === 0)
          this.downloadProgress[trip.id] = 100

        // 3. Загружаем картинки (батчами, чтобы не положить сеть)
        const BATCH_SIZE = 5
        for (let i = 0; i < urlsArray.length; i += BATCH_SIZE) {
          const batch = urlsArray.slice(i, i + BATCH_SIZE)

          await Promise.all(batch.map(async (url) => {
            try {
              // Проверяем, есть ли уже в кеше, чтобы не качать зря
              const match = await cache.match(url)
              if (!match) {
                // Пытаемся скачать с CORS
                // Если картинки на S3/CDN без CORS заголовков, fetch упадет.
                // Тогда делаем fallback на no-cors (opaque response).
                let response
                try {
                  const request = new Request(url, { mode: 'cors' })
                  response = await fetch(request)
                }
                catch {
                  const noCorsRequest = new Request(url, { mode: 'no-cors' })
                  response = await fetch(noCorsRequest)
                }

                if (response) {
                  // status 0 для opaque (no-cors) ответов - это нормально для SW
                  if (response.ok || response.status === 0) {
                    await cache.put(url, response)
                  }
                }
              }
            }
            catch (e) {
              console.warn(`[Offline] Не удалось закешировать: ${url}`, e)
            }
            finally {
              loadedCount++
              // Обновляем прогресс
              this.downloadProgress[trip.id] = Math.round((loadedCount / urlsArray.length) * 100)
            }
          }))
        }

        // 4. Сохраняем JSON данные в LocalStorage (через useStorage в state)
        // Делаем глубокую копию, чтобы разорвать реактивность
        this.savedTrips[trip.id] = {
          id: trip.id,
          title: trip.title,
          savedAt: Date.now(),
          imageCount: urlsArray.length,
          data: JSON.parse(JSON.stringify(trip)),
        }

        toast.success(`Путешествие "${trip.title}" сохранено оффлайн!`)
      }
      catch (e) {
        console.error('Ошибка при сохранении оффлайн:', e)
        toast.error('Не удалось сохранить путешествие.')
      }
      finally {
        this.isDownloading[trip.id] = false
        // Очищаем прогресс через небольшую паузу для красоты UI
        setTimeout(() => {
          delete this.downloadProgress[trip.id]
        }, 1000)
      }
    },

    /**
     * Удаление путешествия из оффлайн доступа
     */
    async removeOfflineTrip(tripId: string) {
      if (!this.savedTrips[tripId])
        return

      const toast = useToast()

      // Удаляем запись о путешествии из LocalStorage
      delete this.savedTrips[tripId]

      // Примечание: Мы НЕ чистим Cache Storage (картинки) здесь.
      // Причина: Картинки могут использоваться в других путешествиях или быть закешированы браузером.
      // Браузер сам удалит старые неиспользуемые файлы, когда место закончится (LRU).
      // Полную очистку можно сделать отдельной кнопкой "Очистить весь кеш" в настройках.

      toast.info('Путешествие удалено из памяти устройства.')
    },

    /**
     * Обновление уже сохраненного путешествия
     */
    async updateOfflineTrip(trip: TripWithDays) {
      await this.saveTripForOffline(trip)
    },
  },
})
