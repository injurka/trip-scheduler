import type { TripDocumentResponse, TripNote } from '~/shared/services/api/model/types'
import type { TripWithDays } from '~/shared/types/models/trip'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'
import { resolveApiUrl } from '~/shared/lib/url'
import { trpc } from '~/shared/services/trpc/trpc.service'

const OFFLINE_MEDIA_CACHE_NAME = 'trip-scheduler-offline-media'

export interface OfflineTripEntry {
  id: string
  title: string
  savedAt: number
  imageCount: number
  data: TripWithDays
  notes?: TripNote[]
  documents?: TripDocumentResponse[]
}

export interface OfflineDownloadStatus {
  progress: number
  total: number
  loaded: number
  stage: 'fetching' | 'caching' | 'completed' | 'error'
  statusText: string
}

export interface IOfflineState {
  savedTrips: Record<string, OfflineTripEntry>
  isDownloading: Record<string, boolean>
  downloadProgress: Record<string, number>
  downloadStatus: Record<string, OfflineDownloadStatus>
}

function extractUrlsFromMarkdown(text: string | null | undefined): string[] {
  if (!text)
    return []
  const urls: string[] = []
  const mdImgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g
  let match: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = mdImgRegex.exec(text)) !== null) {
    if (match[1])
      urls.push(match[1])
  }
  const htmlImgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+|\/[^"']+)["']/gi
  // eslint-disable-next-line no-cond-assign
  while ((match = htmlImgRegex.exec(text)) !== null) {
    if (match[1])
      urls.push(match[1])
  }
  return urls
}

export const useOfflineStore = defineStore('offline', {
  state: () => ({
    savedTrips: useStorage<Record<string, OfflineTripEntry>>('offline-trips-data', {}),
    isDownloading: {} as Record<string, boolean>,
    downloadProgress: {} as Record<string, number>,
    downloadStatus: {} as Record<string, OfflineDownloadStatus>,
  }),

  getters: {
    isTripCached: state => (tripId: string) => !!state.savedTrips[tripId],
    getSavedTrip: state => (tripId: string) => state.savedTrips[tripId]?.data,
    getSavedTripNotes: state => (tripId: string) => state.savedTrips[tripId]?.notes ?? [],
    getSavedTripDocuments: state => (tripId: string) => state.savedTrips[tripId]?.documents ?? [],
    sortedSavedTrips: (state) => {
      return Object.values(state.savedTrips).sort((a, b) => b.savedAt - a.savedAt)
    },
    getDownloadProgress: state => (tripId: string) => state.downloadProgress[tripId] || 0,
    getDownloadStatus: state => (tripId: string) => state.downloadStatus[tripId],
    isTripDownloading: state => (tripId: string) => !!state.isDownloading[tripId],
  },

  actions: {
    async saveTripByIdForOffline(tripId: string) {
      if (this.isDownloading[tripId])
        return

      const toast = useToast()
      try {
        const tripData = await trpc.trip.getByIdWithDays.query({ tripId })
        if (!tripData) {
          toast.error('Не удалось загрузить данные путешествия для оффлайн сохранения.')
          return
        }
        await this.saveTripForOffline(tripData as unknown as TripWithDays)
      }
      catch (e) {
        console.error('[Offline] Ошибка загрузки путешествия по ID:', e)
        toast.error('Не удалось загрузить данные путешествия.')
      }
    },

    async saveTripForOffline(trip: TripWithDays) {
      if (this.isDownloading[trip.id])
        return

      this.isDownloading[trip.id] = true
      this.downloadProgress[trip.id] = 0
      this.downloadStatus[trip.id] = {
        progress: 0,
        total: 0,
        loaded: 0,
        stage: 'fetching',
        statusText: 'Подготовка данных и загрузка заметок...',
      }
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

        // Обложка путешествия
        addUrl(trip.imageUrl)

        // Аватары участников
        trip.participants?.forEach((p) => {
          if (p.avatarUrl)
            addUrl(p.avatarUrl)
        })

        // Markdown в описаниях путешествия
        extractUrlsFromMarkdown(trip.description).forEach(addUrl)
        extractUrlsFromMarkdown(trip.descriptionShort).forEach(addUrl)

        // 1. Загрузка заметок (Notes)
        let loadedNotes: TripNote[] = this.savedTrips[trip.id]?.notes || []
        // 2. Загрузка документов (Documents)
        let loadedDocuments: TripDocumentResponse[] = this.savedTrips[trip.id]?.documents || []

        const [notesResult, docsResult] = await Promise.allSettled([
          trpc.note.getByTripId.query({ tripId: trip.id }),
          trpc.image.listDocuments.query({ tripId: trip.id }),
        ])

        if (notesResult.status === 'fulfilled' && Array.isArray(notesResult.value)) {
          loadedNotes = notesResult.value as TripNote[]
        }
        else if (notesResult.status === 'rejected') {
          console.warn('[Offline] Не удалось загрузить свежие заметки для оффлайн сохранения:', notesResult.reason)
        }

        if (docsResult.status === 'fulfilled' && Array.isArray(docsResult.value)) {
          loadedDocuments = docsResult.value as unknown as TripDocumentResponse[]
        }
        else if (docsResult.status === 'rejected') {
          console.warn('[Offline] Не удалось загрузить свежие документы для оффлайн сохранения:', docsResult.reason)
        }

        // Кэширование изображений заметок
        loadedNotes.forEach((note) => {
          if (note.images && Array.isArray(note.images)) {
            note.images.forEach((img) => {
              if (img.sources) {
                Object.values(img.sources).forEach(src => addUrl(src))
              }
            })
          }
          if (note.content) {
            extractUrlsFromMarkdown(note.content).forEach(addUrl)
          }
        })

        // Кэширование документов
        loadedDocuments.forEach((doc) => {
          if (doc.url) {
            addUrl(doc.url)
          }
        })

        // Кэширование секций путешествия
        trip.sections?.forEach((section: any) => {
          if (section.type === 'gallery' && Array.isArray(section.content?.imageUrls)) {
            section.content.imageUrls.forEach(addUrl)
          }
          if (section.type === 'documents' && Array.isArray(section.content?.documents)) {
            section.content.documents.forEach((doc: any) => {
              addUrl(doc.url)
            })
          }
          if (section.type === 'bookings' && Array.isArray(section.content?.bookings)) {
            section.content.bookings.forEach((b: any) => {
              if (b.attachmentUrl)
                addUrl(b.attachmentUrl)
              if (b.ticketUrl)
                addUrl(b.ticketUrl)
              if (b.fileUrl)
                addUrl(b.fileUrl)
            })
          }
          if (typeof section.content?.markdown === 'string') {
            extractUrlsFromMarkdown(section.content.markdown).forEach(addUrl)
          }
          if (typeof section.content?.text === 'string') {
            extractUrlsFromMarkdown(section.content.text).forEach(addUrl)
          }
        })

        // Кэширование дней и активностей
        trip.days?.forEach((day) => {
          if (day.description)
            extractUrlsFromMarkdown(day.description).forEach(addUrl)
          if (day.note)
            extractUrlsFromMarkdown(day.note).forEach(addUrl)

          day.activities?.forEach((activity) => {
            if (activity.explanation)
              extractUrlsFromMarkdown(activity.explanation).forEach(addUrl)

            activity.sections?.forEach((section: any) => {
              if (section.type === 'gallery') {
                if (Array.isArray(section.imageUrls))
                  section.imageUrls.forEach(addUrl)
                if (Array.isArray(section.content?.imageUrls))
                  section.content.imageUrls.forEach(addUrl)
              }
              if (section.type === 'geolocation' && Array.isArray(section.points)) {
                section.points.forEach((point: any) => {
                  if (point.imageUrl)
                    addUrl(point.imageUrl)
                  if (point.style?.iconUrl)
                    addUrl(point.style.iconUrl)
                })
              }
              if (section.type === 'description' && section.text) {
                extractUrlsFromMarkdown(section.text).forEach(addUrl)
              }
            })
          })
        })

        const urlsArray = Array.from(urlsToCache)
        const totalCount = urlsArray.length
        let loadedCount = 0

        if (totalCount === 0) {
          this.downloadProgress[trip.id] = 100
          this.downloadStatus[trip.id] = {
            progress: 100,
            total: 0,
            loaded: 0,
            stage: 'completed',
            statusText: 'Все данные сохранены!',
          }
        }
        else {
          this.downloadStatus[trip.id] = {
            progress: 0,
            total: totalCount,
            loaded: 0,
            stage: 'caching',
            statusText: `Кэширование файлов (0/${totalCount})...`,
          }
        }

        if (typeof caches !== 'undefined' && totalCount > 0) {
          try {
            const cache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)
            const BATCH_SIZE = 4
            for (let i = 0; i < urlsArray.length; i += BATCH_SIZE) {
              const batch = urlsArray.slice(i, i + BATCH_SIZE)

              await Promise.all(batch.map(async (rawUrl) => {
                const url = resolveApiUrl(rawUrl)
                try {
                  const match = await cache.match(url) || await cache.match(rawUrl)
                  if (!match) {
                    let response: Response | null = null
                    try {
                      response = await fetch(url, { mode: 'cors', cache: 'reload' })
                    }
                    catch {
                      try {
                        response = await fetch(url, { mode: 'no-cors', cache: 'reload' })
                      }
                      catch {
                        // fetch failed
                      }
                    }

                    if (response && (response.ok || response.type === 'opaque')) {
                      await cache.put(url, response.clone())
                      if (url !== rawUrl) {
                        await cache.put(rawUrl, response)
                      }
                    }
                  }
                }
                catch (e) {
                  console.warn(`[Offline] Skip: ${url}`, e)
                }
                finally {
                  loadedCount++
                  const pct = Math.min(100, Math.round((loadedCount / totalCount) * 100))
                  this.downloadProgress[trip.id] = pct
                  this.downloadStatus[trip.id] = {
                    progress: pct,
                    total: totalCount,
                    loaded: loadedCount,
                    stage: 'caching',
                    statusText: `Кэширование файлов (${loadedCount}/${totalCount})...`,
                  }
                }
              }))
            }
          }
          catch (e) {
            console.warn('[Offline] caches API error:', e)
          }
        }

        this.savedTrips[trip.id] = {
          ...this.savedTrips[trip.id],
          id: trip.id,
          title: trip.title,
          savedAt: Date.now(),
          imageCount: totalCount,
          data: JSON.parse(JSON.stringify(trip)),
          notes: loadedNotes,
          documents: loadedDocuments,
        }

        this.downloadProgress[trip.id] = 100
        this.downloadStatus[trip.id] = {
          progress: 100,
          total: totalCount,
          loaded: totalCount,
          stage: 'completed',
          statusText: 'Сохранение завершено!',
        }

        toast.success(`Путешествие "${trip.title}" сохранено оффлайн!`)
      }
      catch (e) {
        console.error('[Offline] Ошибка сохранения:', e)
        this.downloadStatus[trip.id] = {
          progress: this.downloadProgress[trip.id] || 0,
          total: 0,
          loaded: 0,
          stage: 'error',
          statusText: 'Ошибка сохранения.',
        }
        toast.error('Ошибка при сохранении оффлайн.')
      }
      finally {
        setTimeout(() => {
          this.isDownloading[trip.id] = false
          delete this.downloadProgress[trip.id]
          delete this.downloadStatus[trip.id]
        }, 1200)
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
