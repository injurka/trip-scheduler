import type { TripWithDays } from '~/shared/types/models/trip'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'

const OFFLINE_MEDIA_CACHE_NAME = 'trip-scheduler-offline-media'

export interface OfflineTripEntry {
  id: string
  title: string
  savedAt: number
  imageCount: number
  data: TripWithDays
}

export interface IOfflineState {
  savedTrips: Record<string, OfflineTripEntry>
  isDownloading: Record<string, boolean>
  downloadProgress: Record<string, number>
}

export const useOfflineStore = defineStore('offline', {
  state: (): IOfflineState => ({
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
    async saveTripForOffline(trip: TripWithDays) {
      if (this.isDownloading[trip.id])
        return

      this.isDownloading[trip.id] = true
      this.downloadProgress[trip.id] = 0
      const toast = useToast()

      if (!this.savedTrips[trip.id]) {
        this.savedTrips[trip.id] = {
          id: trip.id,
          title: trip.title,
          savedAt: Date.now(),
          imageCount: 0,
          data: JSON.parse(JSON.stringify(trip)),
        }
      }

      try {
        const urlsToCache = new Set<string>()

        const addUrl = (url: string | null | undefined) => {
          if (!url)
            return
          if (url.startsWith('blob:') || url.startsWith('data:'))
            return
          if (url.includes('/memories/'))
            return
          urlsToCache.add(url)
        }

        // --- Сбор URL ---
        addUrl(trip.imageUrl)

        trip.sections.forEach((section: any) => {
          if (section.type === 'gallery' && Array.isArray(section.content?.imageUrls)) {
            section.content.imageUrls.forEach(addUrl)
          }
          if (section.type === 'documents' && Array.isArray(section.content?.documents)) {
            section.content.documents.forEach((doc: any) => {
              if (['jpg', 'jpeg', 'png', 'webp'].includes(doc.fileType?.toLowerCase())) {
                addUrl(doc.url)
              }
            })
          }
        })

        trip.days.forEach((day) => {
          day.activities.forEach((activity) => {
            activity.sections?.forEach((section: any) => {
              if (section.type === 'gallery' && Array.isArray(section.imageUrls)) {
                section.imageUrls.forEach(addUrl)
              }
              if (section.type === 'geolocation' && Array.isArray(section.points)) {
                section.points.forEach((point: any) => {
                  if (point.imageUrl)
                    addUrl(point.imageUrl)
                  if (point.style?.iconUrl)
                    addUrl(point.style.iconUrl)
                })
              }
            })
          })
        })

        const cache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)
        const urlsArray = Array.from(urlsToCache)
        let loadedCount = 0

        if (urlsArray.length === 0)
          this.downloadProgress[trip.id] = 100

        // --- Загрузка ---
        const BATCH_SIZE = 5
        for (let i = 0; i < urlsArray.length; i += BATCH_SIZE) {
          const batch = urlsArray.slice(i, i + BATCH_SIZE)

          await Promise.all(batch.map(async (url) => {
            try {
              // 1. Проверяем, есть ли уже в кеше (по строке URL!)
              const match = await cache.match(url)
              if (match) {
                loadedCount++
                this.downloadProgress[trip.id] = Math.round((loadedCount / urlsArray.length) * 100)
                return
              }

              // 2. Скачиваем
              let response
              try {
                // Пытаемся скачать "по-честному" (CORS)
                response = await fetch(url, { mode: 'cors', cache: 'reload' })
              }
              catch {
                // Если CORS ошибка, пробуем no-cors (Opaque)
                response = await fetch(url, { mode: 'no-cors', cache: 'reload' })
              }

              // 3. Кладем в кеш, используя URL как ключ (ВАЖНО!)
              if (response && (response.ok || response.type === 'opaque')) {
                await cache.put(url, response)
              }
            }
            catch (e) {
              console.warn(`[Offline] Skip: ${url}`, e)
            }
            finally {
              loadedCount++
              this.downloadProgress[trip.id] = Math.round((loadedCount / urlsArray.length) * 100)
            }
          }))
        }

        // Обновляем запись (final data + timestamp)
        this.savedTrips[trip.id] = {
          ...this.savedTrips[trip.id],
          savedAt: Date.now(),
          imageCount: urlsArray.length,
          data: JSON.parse(JSON.stringify(trip)),
        }

        toast.success(`Путешествие "${trip.title}" сохранено!`)
      }
      catch (e) {
        console.error('Ошибка сохранения:', e)
        toast.error('Ошибка при сохранении оффлайн.')
      }
      finally {
        setTimeout(() => {
          this.isDownloading[trip.id] = false
          delete this.downloadProgress[trip.id]
        }, 1000)
      }
    },

    async removeOfflineTrip(tripId: string) {
      if (!this.savedTrips[tripId])
        return
      delete this.savedTrips[tripId]
      useToast().info('Путешествие удалено из памяти устройства.')
    },

    async updateOfflineTrip(trip: TripWithDays) {
      await this.saveTripForOffline(trip)
    },
  },
})
