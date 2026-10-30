import type { TripDocumentResponse, TripNote } from '~/shared/services/api/model/types'
import type { TripWithDays } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'
import { MAPTILER_KEY } from '~/shared/lib/map-styles-sources'
import { mapTileCacheManager } from '~/shared/lib/map-tile-cache'
import { calculateTripBoundingBox, getTilesForBBox } from '~/shared/lib/tile-calc'
import { resolveApiUrl, stripAuthTokenFromUrl } from '~/shared/lib/url'
import { offlineStorageService } from '~/shared/services/offline/offline-storage.service'
import { trpc } from '~/shared/services/trpc/trpc.service'

const OFFLINE_MEDIA_CACHE_NAME = 'trip-scheduler-offline-media'

export interface OfflineTripEntry {
  /** Version of the serialized trip payload, independent of IndexedDB schema version. */
  payloadSchemaVersion: number
  id: string
  title: string
  savedAt: number
  imageCount: number
  data: TripWithDays
  notes?: TripNote[]
  documents?: TripDocumentResponse[]
  includesTiles?: boolean
}

export interface OfflineDownloadOptions {
  includeMedia?: boolean
  includeNotes?: boolean
  includeDocuments?: boolean
  includeMapTiles?: boolean
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
  isInitialized: boolean
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

function addOfflineUrl(urls: Set<string>, url: string | null | undefined) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.includes('/memories/'))
    return

  urls.add(url)
}

function addMarkdownUrls(urls: Set<string>, text: string | null | undefined) {
  extractUrlsFromMarkdown(text).forEach(url => addOfflineUrl(urls, url))
}

function collectDescriptionMediaUrls(trip: TripWithDays, urls: Set<string>) {
  addOfflineUrl(urls, trip.imageUrl)
  trip.participants?.forEach(participant => addOfflineUrl(urls, participant.avatarUrl))
  addMarkdownUrls(urls, trip.description)
  addMarkdownUrls(urls, trip.descriptionShort)
}

function collectNoteMediaUrls(notes: TripNote[], urls: Set<string>) {
  notes.forEach((note) => {
    note.images?.forEach((image) => {
      if (image.sources)
        Object.values(image.sources).forEach(url => addOfflineUrl(urls, url))
    })

    addMarkdownUrls(urls, note.content)
  })
}

function collectDocumentSectionUrls(section: any, urls: Set<string>) {
  if (section.type === 'documents' && Array.isArray(section.content?.documents))
    section.content.documents.forEach((doc: any) => addOfflineUrl(urls, doc.url))

  if (section.type === 'bookings' && Array.isArray(section.content?.bookings)) {
    section.content.bookings.forEach((booking: any) => {
      addOfflineUrl(urls, booking.attachmentUrl)
      addOfflineUrl(urls, booking.ticketUrl)
      addOfflineUrl(urls, booking.fileUrl)
    })
  }
}

function collectMediaSectionUrls(section: any, urls: Set<string>) {
  if (section.type === 'gallery' && Array.isArray(section.content?.imageUrls))
    section.content.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))

  if (typeof section.content?.markdown === 'string')
    addMarkdownUrls(urls, section.content.markdown)

  if (typeof section.content?.text === 'string')
    addMarkdownUrls(urls, section.content.text)
}

function collectSectionUrls(
  section: any,
  includeMedia: boolean,
  includeDocuments: boolean,
  urls: Set<string>,
) {
  if (includeDocuments)
    collectDocumentSectionUrls(section, urls)

  if (includeMedia)
    collectMediaSectionUrls(section, urls)
}

function collectActivitySectionUrls(section: any, urls: Set<string>) {
  if (section.type === 'gallery') {
    if (Array.isArray(section.imageUrls))
      section.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))

    if (Array.isArray(section.content?.imageUrls))
      section.content.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))
  }

  if (section.type === 'geolocation' && Array.isArray(section.points)) {
    section.points.forEach((point: any) => {
      addOfflineUrl(urls, point.imageUrl)
      addOfflineUrl(urls, point.style?.iconUrl)
    })
  }

  if (section.type === 'description' && section.text)
    addMarkdownUrls(urls, section.text)
}

function collectTripDayUrls(trip: TripWithDays, urls: Set<string>) {
  trip.days?.forEach((day) => {
    addMarkdownUrls(urls, day.description)
    addMarkdownUrls(urls, day.note)

    day.activities?.forEach((activity) => {
      addMarkdownUrls(urls, activity.explanation)
      activity.sections?.forEach(section => collectActivitySectionUrls(section, urls))
    })
  })
}

function collectOfflineUrls(
  trip: TripWithDays,
  options: Required<OfflineDownloadOptions>,
  notes: TripNote[],
  documents: TripDocumentResponse[],
): Set<string> {
  const urls = new Set<string>()

  if (options.includeMedia)
    collectDescriptionMediaUrls(trip, urls)

  if (options.includeNotes && options.includeMedia)
    collectNoteMediaUrls(notes, urls)

  if (options.includeDocuments)
    documents.forEach(document => addOfflineUrl(urls, document.url))

  trip.sections?.forEach(section => collectSectionUrls(
    section,
    options.includeMedia,
    options.includeDocuments,
    urls,
  ))

  if (options.includeMedia)
    collectTripDayUrls(trip, urls)

  return urls
}

function getTripMapTileUrls(trip: TripWithDays, includeMapTiles: boolean): string[] {
  if (!includeMapTiles)
    return []

  const bounds = calculateTripBoundingBox(trip)

  if (!bounds)
    return []

  const tiles = getTilesForBBox(
    bounds,
    10,
    15,
    450,
  )

  if (MAPTILER_KEY) {
    const urls = [
      `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`,
      `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${MAPTILER_KEY}`,
    ]

    tiles.forEach(({ z, x, y }) => {
      urls.push(`https://api.maptiler.com/maps/streets-v4/${z}/${x}/${y}.pbf?key=${MAPTILER_KEY}`)
      urls.push(`https://api.maptiler.com/maps/outdoor-v4/${z}/${x}/${y}.pbf?key=${MAPTILER_KEY}`)
    })

    return urls
  }

  return tiles.map(({ z, x, y }) => `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`)
}

interface OfflineMetadataResult {
  notes: TripNote[]
  notesFetchSuccess: boolean
  documents: TripDocumentResponse[]
  documentsFetchSuccess: boolean
  failureCount: number
}

async function fetchOfflineMetadata(tripId: string, options: Required<OfflineDownloadOptions>): Promise<OfflineMetadataResult> {
  const [notesResult, documentsResult] = await Promise.all([
    options.includeNotes ? fetchOfflineNotes(tripId) : Promise.resolve({ items: [], success: false, failed: 0 }),
    options.includeDocuments ? fetchOfflineDocuments(tripId) : Promise.resolve({ items: [], success: false, failed: 0 }),
  ])

  return {
    notes: notesResult.items,
    notesFetchSuccess: notesResult.success,
    documents: documentsResult.items,
    documentsFetchSuccess: documentsResult.success,
    failureCount: notesResult.failed + documentsResult.failed,
  }
}

async function fetchOfflineNotes(tripId: string) {
  try {
    const notes: unknown = await trpc.note.getByTripId.query({ tripId })

    if (Array.isArray(notes))
      return { items: notes as TripNote[], success: true, failed: 0 }

    console.warn('[Offline] Не удалось загрузить свежие заметки: некорректный ответ')

    return { items: [] as TripNote[], success: false, failed: 1 }
  }
  catch (error) {
    console.warn('[Offline] Не удалось загрузить свежие заметки:', error)

    return { items: [] as TripNote[], success: false, failed: 1 }
  }
}

async function fetchOfflineDocuments(tripId: string) {
  try {
    const documents: unknown = await trpc.image.listDocuments.query({ tripId })

    if (Array.isArray(documents))
      return { items: documents as unknown as TripDocumentResponse[], success: true, failed: 0 }

    console.warn('[Offline] Не удалось загрузить свежие документы: некорректный ответ')

    return { items: [] as TripDocumentResponse[], success: false, failed: 1 }
  }
  catch (error) {
    console.warn('[Offline] Не удалось загрузить свежие документы:', error)

    return { items: [] as TripDocumentResponse[], success: false, failed: 1 }
  }
}

async function fetchOfflineMediaResponse(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { mode: 'cors', cache: 'reload' })
  }
  catch {
    try {
      return await fetch(url, { mode: 'no-cors', cache: 'reload' })
    }
    catch {
      return null
    }
  }
}

async function cacheOfflineUrl(cache: Cache, rawUrl: string): Promise<boolean> {
  const url = resolveApiUrl(rawUrl)
  const urlWithoutToken = stripAuthTokenFromUrl(url)

  try {
    const cached = await cache.match(url)
      || (urlWithoutToken ? await cache.match(urlWithoutToken) : null)

    if (cached)
      return true

    const response = await fetchOfflineMediaResponse(url)

    if (!response || (!response.ok && response.type !== 'opaque'))
      return false

    await cache.put(url, response.clone())

    if (urlWithoutToken && urlWithoutToken !== url)
      await cache.put(urlWithoutToken, response.clone())

    return true
  }
  catch (error) {
    console.warn(`[Offline] Ошибка кэширования: ${url}`, error)

    return false
  }
}

interface CacheResult {
  loadedCount: number
  failedCount: number
}

async function cacheOfflineMediaUrls(urls: string[], onProgress: (loadedCount: number) => void): Promise<CacheResult> {
  let loadedCount = 0
  let failedCount = 0

  try {
    if (typeof caches === 'undefined')
      throw new Error('Cache Storage API недоступен')

    const cache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)

    for (let offset = 0; offset < urls.length; offset += 4) {
      const results = await Promise.all(urls.slice(offset, offset + 4).map(url => cacheOfflineUrl(cache, url)))

      results.forEach((success) => {
        if (!success)
          failedCount++

        loadedCount++
        onProgress(loadedCount)
      })
    }
  }
  catch (error) {
    console.warn('[Offline] caches API error:', error)
    const remaining = urls.length - loadedCount
    failedCount += remaining
    loadedCount += remaining

    if (remaining > 0)
      onProgress(loadedCount)
  }

  return { loadedCount, failedCount }
}

async function cacheMapTiles(
  tripId: string,
  tileUrls: string[],
  mediaCount: number,
  totalCount: number,
  state: IOfflineState,
): Promise<{ failedCount: number, successCount: number }> {
  try {
    return await mapTileCacheManager.precacheUrls(tileUrls, (loaded) => {
      const currentLoaded = mediaCount + loaded
      const progress = Math.min(100, Math.round((currentLoaded / totalCount) * 100))
      state.downloadProgress[tripId] = progress
      state.downloadStatus[tripId] = {
        progress,
        total: totalCount,
        loaded: currentLoaded,
        stage: 'caching',
        statusText: `Кэширование тайлов карты (${loaded}/${tileUrls.length})...`,
      }
    })
  }
  catch (error) {
    console.warn('[Offline] Не удалось сохранить тайлы карты:', error)
    const currentLoaded = mediaCount + tileUrls.length
    const progress = Math.min(100, Math.round((currentLoaded / totalCount) * 100))
    state.downloadProgress[tripId] = progress
    state.downloadStatus[tripId] = {
      progress,
      total: totalCount,
      loaded: currentLoaded,
      stage: 'caching',
      statusText: `Кэширование тайлов карты (${tileUrls.length}/${tileUrls.length})...`,
    }

    return { failedCount: tileUrls.length, successCount: 0 }
  }
}

function normalizeDownloadOptions(options?: OfflineDownloadOptions): Required<OfflineDownloadOptions> {
  return {
    includeMedia: options?.includeMedia ?? true,
    includeNotes: options?.includeNotes ?? true,
    includeDocuments: options?.includeDocuments ?? true,
    includeMapTiles: options?.includeMapTiles ?? false,
  }
}

function setInitialDownloadStatus(state: IOfflineState, tripId: string) {
  state.isDownloading[tripId] = true
  state.downloadProgress[tripId] = 0
  state.downloadStatus[tripId] = {
    progress: 0,
    total: 0,
    loaded: 0,
    stage: 'fetching',
    statusText: 'Подготовка данных и загрузка заметок...',
  }
}

function setInitialCacheStatus(state: IOfflineState, tripId: string, totalCount: number) {
  if (totalCount === 0) {
    state.downloadProgress[tripId] = 100
    state.downloadStatus[tripId] = {
      progress: 100,
      total: 0,
      loaded: 0,
      stage: 'completed',
      statusText: 'Все данные сохранены!',
    }

    return
  }

  state.downloadStatus[tripId] = {
    progress: 0,
    total: totalCount,
    loaded: 0,
    stage: 'caching',
    statusText: `Кэширование файлов (0/${totalCount})...`,
  }
}

function updateMediaCacheProgress(
  state: IOfflineState,
  tripId: string,
  totalCount: number,
  loaded: number,
) {
  const progress = Math.min(100, Math.round((loaded / totalCount) * 100))
  state.downloadProgress[tripId] = progress
  state.downloadStatus[tripId] = {
    progress,
    total: totalCount,
    loaded,
    stage: 'caching',
    statusText: `Кэширование файлов (${loaded}/${totalCount})...`,
  }
}

function getDocumentsToSave(current: OfflineTripEntry | undefined, options: Required<OfflineDownloadOptions>, metadata: OfflineMetadataResult): TripDocumentResponse[] {
  if (options.includeDocuments && metadata.documentsFetchSuccess)
    return metadata.documents

  return current?.documents ?? []
}

function getNotesToSave(current: OfflineTripEntry | undefined, options: Required<OfflineDownloadOptions>, metadata: OfflineMetadataResult): TripNote[] {
  if (options.includeNotes && metadata.notesFetchSuccess)
    return metadata.notes

  return current?.notes ?? []
}

function shouldIncludeOfflineTiles(
  current: OfflineTripEntry | undefined,
  options: Required<OfflineDownloadOptions>,
  tileCount: number,
  tileSuccesses: number,
  tileFailures: number,
): boolean {
  if (!options.includeMapTiles)
    return current?.includesTiles ?? false

  const tilesSuccessfullyCached = tileCount > 0 && tileSuccesses > 0

  return tilesSuccessfullyCached || Boolean(current?.includesTiles && tileFailures === 0)
}

function createOfflineTripEntry(
  trip: TripWithDays,
  current: OfflineTripEntry | undefined,
  documents: TripDocumentResponse[],
  notes: TripNote[],
  mediaCount: number,
  includesTiles: boolean,
): OfflineTripEntry {
  return {
    ...current,
    payloadSchemaVersion: 2,
    id: trip.id,
    title: trip.title,
    savedAt: Date.now(),
    imageCount: mediaCount,
    data: JSON.parse(JSON.stringify(trip)),
    notes,
    documents,
    includesTiles,
  }
}

function setOfflineSaveCompletion(
  state: IOfflineState,
  trip: TripWithDays,
  totalCount: number,
  failedCount: number,
  metadataFailureCount: number,
  toast: ReturnType<typeof useToast>,
) {
  state.downloadProgress[trip.id] = 100

  if (failedCount > 0 || metadataFailureCount > 0) {
    const totalFailures = failedCount + metadataFailureCount
    const successCount = Math.max(0, totalCount - failedCount)
    state.downloadStatus[trip.id] = {
      progress: 100,
      total: totalCount,
      loaded: successCount,
      stage: 'completed',
      statusText: `Сохранено с предупреждением (${totalFailures} элементов недоступно)`,
    }
    toast.warn(`Путешествие сохранено не полностью: недоступно элементов — ${totalFailures}.`)

    return
  }

  state.downloadStatus[trip.id] = {
    progress: 100,
    total: totalCount,
    loaded: totalCount,
    stage: 'completed',
    statusText: 'Все данные успешно сохранены!',
  }
  toast.success(`Путешествие "${trip.title}" сохранено оффлайн!`)
}

export const useOfflineStore = defineStore('offline', {
  state: (): IOfflineState => ({
    savedTrips: {},
    isDownloading: {},
    downloadProgress: {},
    downloadStatus: {},
    isInitialized: false,
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
    /**
     * Инициализация хранилища из IndexedDB (с прозрачной миграцией из localStorage)
     */
    async initStorage() {
      if (this.isInitialized)
        return

      try {
        const trips = await offlineStorageService.loadAllTrips()
        this.savedTrips = Object.fromEntries(Object.entries(trips).map(([id, entry]) => [id, {
          ...entry,
          // Older snapshots contain only the legacy city labels. Keep them readable offline;
          // never try to resolve those labels against the network during hydration.
          payloadSchemaVersion: entry.payloadSchemaVersion ?? 1,
        }]))
      }
      catch (e) {
        console.warn('[OfflineStore] Ошибка инициализации IndexedDB:', e)
      }
      finally {
        this.isInitialized = true
      }
    },

    async saveTripByIdForOffline(tripId: string, options?: OfflineDownloadOptions) {
      if (this.isDownloading[tripId])
        return

      const toast = useToast()

      try {
        const tripData = await trpc.trip.getByIdWithDays.query({ tripId })

        if (!tripData) {
          toast.error('Не удалось загрузить данные путешествия для оффлайн сохранения.')

          return
        }

        await this.saveTripForOffline(tripData as unknown as TripWithDays, options)
      }
      catch (e) {
        console.error('[Offline] Ошибка загрузки путешествия по ID:', e)
        toast.error('Не удалось загрузить данные путешествия.')
      }
    },

    async saveTripForOffline(trip: TripWithDays, options?: OfflineDownloadOptions) {
      if (this.isDownloading[trip.id])
        return

      const downloadOpts = normalizeDownloadOptions(options)
      setInitialDownloadStatus(this, trip.id)
      const toast = useToast()

      try {
        const metadata = await fetchOfflineMetadata(trip.id, downloadOpts)
        const urlsArray = Array.from(collectOfflineUrls(
          trip,
          downloadOpts,
          metadata.notes,
          metadata.documents,
        ))
        const tileUrls = getTripMapTileUrls(trip, downloadOpts.includeMapTiles)
        const totalCount = urlsArray.length + tileUrls.length

        setInitialCacheStatus(this, trip.id, totalCount)

        let failedCount = 0

        if (urlsArray.length > 0) {
          const cacheResult = await cacheOfflineMediaUrls(urlsArray, loaded => updateMediaCacheProgress(
            this,
            trip.id,
            totalCount,
            loaded,
          ))
          failedCount = cacheResult.failedCount
        }

        let tileFailures = 0
        let tileSuccesses = 0

        if (tileUrls.length > 0) {
          this.downloadStatus[trip.id] = {
            ...this.downloadStatus[trip.id],
            statusText: 'Предзагрузка тайлов карты зоны поездки...',
          }

          const tileResult = await cacheMapTiles(
            trip.id,
            tileUrls,
            urlsArray.length,
            totalCount,
            this,
          )
          tileFailures = tileResult.failedCount
          tileSuccesses = tileResult.successCount
          failedCount += tileResult.failedCount
        }

        const current = this.savedTrips[trip.id]
        const documents = getDocumentsToSave(current, downloadOpts, metadata)
        const notes = getNotesToSave(current, downloadOpts, metadata)
        const includesTiles = shouldIncludeOfflineTiles(
          current,
          downloadOpts,
          tileUrls.length,
          tileSuccesses,
          tileFailures,
        )
        const entry = createOfflineTripEntry(
          trip,
          current,
          documents,
          notes,
          urlsArray.length,
          includesTiles,
        )

        await offlineStorageService.saveTrip(entry)
        this.savedTrips[trip.id] = entry
        setOfflineSaveCompletion(
          this,
          trip,
          totalCount,
          failedCount,
          metadata.failureCount,
          toast,
        )
      }
      catch (error) {
        console.error('[Offline] Ошибка сохранения:', error)
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

      const toast = useToast()

      try {
        await offlineStorageService.removeTrip(tripId)
        delete this.savedTrips[tripId]
        toast.info('Путешествие удалено из памяти устройства.')
      }
      catch (e) {
        console.error('[Offline] Ошибка удаления сохранённого путешествия:', e)
        toast.error('Не удалось удалить путешествие из памяти устройства.')
      }
    },

    async updateOfflineTrip(trip: TripWithDays, options?: OfflineDownloadOptions) {
      await this.saveTripForOffline(trip, options)
    },
  },
})
