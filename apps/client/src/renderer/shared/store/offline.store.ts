import type { TripDocumentResponse, TripNote } from '~/shared/services/api/model/types'
import type { TripMedia, TripWithDays } from '~/shared/types/models/trip'
import { isRecord } from '@injurka/type-utils'
import { defineStore } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'
import { getOfflineAccountId, getOfflineCachePrefix, OFFLINE_CACHE_READY_URL } from '~/shared/lib/offline-cache'
import { planOfflineMap } from '~/shared/lib/offline-map'
import { resolveApiUrl, stripAuthTokenFromUrl } from '~/shared/lib/url'
import { offlineStorageService } from '~/shared/services/offline/offline-storage.service'
import { trpc } from '~/shared/services/trpc/trpc.service'

export interface OfflineTripEntry {
  /** Version of the serialized trip payload, independent of IndexedDB schema version. */
  downloadedByUserId?: string
  cacheName?: string
  files?: Record<'media' | 'notes' | 'documents' | 'map', string[]>
  media?: TripMedia[]
  payloadSchemaVersion: number
  id: string
  title: string
  savedAt: number
  unavailableCount?: number
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
  tripTitle?: string
}

export interface IOfflineState {
  savedTrips: Record<string, OfflineTripEntry>
  isDownloading: Record<string, boolean>
  downloadProgress: Record<string, number>
  downloadStatus: Record<string, OfflineDownloadStatus>
  accountId: string | null
  isInitialized: boolean
  isProgressMinimized: boolean
  activeProgressTripId: string | null
}

function extractUrlsFromMarkdown(text: unknown): string[] {
  if (typeof text !== 'string' || !text)
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

function addOfflineUrl(urls: Set<string>, url: unknown) {
  if (typeof url !== 'string' || !url || url.startsWith('blob:') || url.startsWith('data:') || url.includes('/memories/'))
    return

  urls.add(url)
}

function addMarkdownUrls(urls: Set<string>, text: unknown) {
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
      if (image.sources) {
        Object.entries(image.sources).forEach(([key, url]) => {
          if (key !== 'thumbhash')
            addOfflineUrl(urls, url)
        })
      }
    })

    addMarkdownUrls(urls, note.content)
  })
}

function collectDocumentSectionUrls(section: unknown, urls: Set<string>) {
  if (!isRecord(section))
    return

  const content = isRecord(section.content) ? section.content : {}

  if (section.type === 'documents' && Array.isArray(content.documents))
    content.documents.filter(isRecord).forEach(doc => addOfflineUrl(urls, doc.url))

  if (section.type === 'bookings' && Array.isArray(content.bookings)) {
    content.bookings.filter(isRecord).forEach((booking) => {
      addOfflineUrl(urls, booking.attachmentUrl)
      addOfflineUrl(urls, booking.ticketUrl)
      addOfflineUrl(urls, booking.fileUrl)

      if (isRecord(booking.data)) {
        for (const field of ['attachmentUrl', 'ticketUrl', 'fileUrl'])
          addOfflineUrl(urls, booking.data[field])
      }
    })
  }
}

function collectBookingMedia(content: Record<string, unknown>, urls: Set<string>) {
  if (!Array.isArray(content.bookings))
    return

  for (const booking of content.bookings.filter(isRecord)) {
    const data = isRecord(booking.data) ? booking.data : {}

    for (const field of ['photos', 'imageUrls']) {
      if (Array.isArray(data[field]))
        data[field].forEach(url => addOfflineUrl(urls, url))
    }
  }
}

function collectMediaSectionUrls(section: unknown, urls: Set<string>) {
  if (!isRecord(section))
    return

  const content = isRecord(section.content) ? section.content : {}

  if (section.type === 'gallery' && Array.isArray(content.imageUrls))
    content.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))

  collectBookingMedia(content, urls)

  if (typeof content.markdown === 'string')
    addMarkdownUrls(urls, content.markdown)

  if (typeof content.text === 'string')
    addMarkdownUrls(urls, content.text)
}

function collectSectionUrls(
  section: unknown,
  includeMedia: boolean,
  includeDocuments: boolean,
  urls: Set<string>,
) {
  if (includeDocuments)
    collectDocumentSectionUrls(section, urls)

  if (includeMedia)
    collectMediaSectionUrls(section, urls)
}

function collectActivitySectionUrls(section: unknown, urls: Set<string>) {
  if (!isRecord(section))
    return

  const content = isRecord(section.content) ? section.content : {}

  if (section.type === 'gallery') {
    if (Array.isArray(section.imageUrls))
      section.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))

    if (Array.isArray(content.imageUrls))
      content.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))
  }

  if (section.type === 'geolocation' && Array.isArray(section.points)) {
    section.points.filter(isRecord).forEach((point) => {
      addOfflineUrl(urls, point.imageUrl)
      addOfflineUrl(urls, isRecord(point.style) ? point.style.iconUrl : undefined)
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

  if (options.includeNotes)
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

async function cacheOfflineUrl(cache: Cache, rawUrl: string, accountId: string | null): Promise<boolean> {
  const url = resolveApiUrl(rawUrl)
  const cleanUrl = stripAuthTokenFromUrl(url)

  try {
    const response = await fetch(url, { mode: 'cors', cache: 'reload', signal: AbortSignal.timeout(30000) })

    if (!response.ok || response.type === 'opaque')
      return false

    if (getOfflineAccountId() !== accountId)
      return false

    await cache.put(cleanUrl, response)

    return true
  }
  catch {
    return false
  }
}

interface CacheResult {
  loadedCount: number
  failedCount: number
}

async function cacheOfflineMediaUrls(cacheName: string, urls: string[], onProgress: (loadedCount: number) => void): Promise<CacheResult> {
  const accountId = getOfflineAccountId()
  let loadedCount = 0
  let failedCount = 0

  try {
    if (typeof caches === 'undefined')
      throw new Error('Cache Storage API недоступен')

    const cache = await caches.open(cacheName)

    for (let offset = 0; offset < urls.length; offset += 4) {
      if (getOfflineAccountId() !== accountId)
        throw new Error('Аккаунт изменился во время скачивания.')

      const results = await Promise.all(urls.slice(offset, offset + 4).map(url => cacheOfflineUrl(cache, url, accountId)))

      results.forEach((success) => {
        if (!success)
          failedCount++

        loadedCount++

        if (getOfflineAccountId() === accountId)
          onProgress(loadedCount)
      })
    }
  }
  catch (error) {
    console.warn('[Offline] caches API error:', error)
    const remaining = urls.length - loadedCount
    failedCount += remaining
    loadedCount += remaining

    if (remaining > 0 && getOfflineAccountId() === accountId)
      onProgress(loadedCount)
  }

  return { loadedCount, failedCount }
}

function normalizeDownloadOptions(options?: OfflineDownloadOptions): Required<OfflineDownloadOptions> {
  return {
    includeMedia: options?.includeMedia ?? true,
    includeNotes: options?.includeNotes ?? true,
    includeDocuments: options?.includeDocuments ?? true,
    includeMapTiles: options?.includeMapTiles ?? false,
  }
}

function setInitialDownloadStatus(state: IOfflineState, tripId: string, tripTitle?: string) {
  state.isDownloading[tripId] = true
  state.downloadProgress[tripId] = 0
  state.downloadStatus[tripId] = {
    progress: 0,
    total: 0,
    loaded: 0,
    stage: 'fetching',
    statusText: 'Подготовка данных и загрузка заметок...',
    tripTitle,
  }
}

function setInitialCacheStatus(state: IOfflineState, tripId: string, totalCount: number) {
  state.downloadStatus[tripId] = {
    progress: 0,
    total: totalCount,
    loaded: 0,
    stage: 'caching',
    statusText: totalCount ? `Кэширование файлов (0/${totalCount})...` : 'Сохранение данных...',
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

  const tilesSuccessfullyCached = tileCount > 0 && tileSuccesses === tileCount && tileFailures === 0

  return tilesSuccessfullyCached
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

async function copyOfflineCache(previous: OfflineTripEntry | undefined, cacheName: string) {
  if (!previous?.cacheName || typeof caches === 'undefined')
    return

  const oldCache = await caches.open(previous.cacheName)
  const nextCache = await caches.open(cacheName)

  for (const request of await oldCache.keys()) {
    if (request.url === OFFLINE_CACHE_READY_URL)
      continue

    const response = await oldCache.match(request)

    if (response)
      await nextCache.put(request, response)
  }
}

async function prepareMap(trip: TripWithDays, cacheName: string, enabled: boolean) {
  if (!enabled)
    return { urls: [] as string[], failed: 0 }

  try {
    return { urls: await planOfflineMap(trip, cacheName), failed: 0 }
  }
  catch (error) {
    useToast().warn(error instanceof Error ? error.message : 'Не удалось подготовить оффлайн-карту.')

    return { urls: [] as string[], failed: 1 }
  }
}

async function prepareMedia(
  tripId: string,
  enabled: boolean,
  previous: OfflineTripEntry | undefined,
  metadata: OfflineMetadataResult,
) {
  if (!enabled)
    return previous?.media ?? []

  try {
    return await trpc.image.listByTrip.query({ tripId, placement: 'route' }) as TripMedia[]
  }
  catch {
    metadata.failureCount++

    return previous?.media ?? []
  }
}

function addMediaVariants(urls: Set<string>, media: TripMedia[]) {
  for (const item of media) {
    addOfflineUrl(urls, item.url)

    for (const [key, url] of Object.entries(item.variants ?? {})) {
      if (key !== 'thumbhash')
        addOfflineUrl(urls, url)
    }
  }
}

function requireSameAccount(accountId: string) {
  if (getOfflineAccountId() !== accountId)
    throw new Error('Аккаунт изменился во время скачивания.')
}

function selectCategoryFiles(
  enabled: boolean,
  urls: Iterable<string>,
  previous: OfflineTripEntry | undefined,
  category: 'media' | 'notes' | 'documents' | 'map',
) {
  return enabled ? [...urls] : previous?.files?.[category] ?? []
}

function prepareFileManifest(
  trip: TripWithDays,
  options: Required<OfflineDownloadOptions>,
  previous: OfflineTripEntry | undefined,
  media: TripMedia[],
  notes: TripNote[],
  documents: TripDocumentResponse[],
  mapUrls: string[],
) {
  const mediaUrls = collectOfflineUrls(
    trip,
    { includeMedia: true, includeNotes: false, includeDocuments: false, includeMapTiles: false },
    [],
    [],
  )
  addMediaVariants(mediaUrls, media)
  const noteUrls = new Set<string>()
  collectNoteMediaUrls(notes, noteUrls)
  const documentUrls = collectOfflineUrls(
    trip,
    { includeMedia: false, includeNotes: false, includeDocuments: true, includeMapTiles: false },
    [],
    documents,
  )

  return {
    media: selectCategoryFiles(
      options.includeMedia,
      mediaUrls,
      previous,
      'media',
    ),
    notes: selectCategoryFiles(
      options.includeNotes,
      noteUrls,
      previous,
      'notes',
    ),
    documents: selectCategoryFiles(
      options.includeDocuments,
      documentUrls,
      previous,
      'documents',
    ),
    map: selectCategoryFiles(
      options.includeMapTiles && mapUrls.length > 0,
      mapUrls,
      previous,
      'map',
    ),
  }
}

async function pruneOfflineCache(cacheName: string, urls: string[]) {
  if (typeof caches === 'undefined')
    return

  const cache = await caches.open(cacheName)
  const wanted = new Set(urls.map(url => stripAuthTokenFromUrl(resolveApiUrl(url))))

  for (const request of await cache.keys()) {
    if (!wanted.has(request.url))
      await cache.delete(request)
  }
}

async function performOfflineDownload(
  state: IOfflineState,
  trip: TripWithDays,
  options: Required<OfflineDownloadOptions>,
  accountId: string,
  cacheName: string,
) {
  const previous = state.savedTrips[trip.id]
  await copyOfflineCache(previous, cacheName)
  const metadata = await fetchOfflineMetadata(trip.id, options)
  const media = await prepareMedia(
    trip.id,
    options.includeMedia,
    previous,
    metadata,
  )
  const map = await prepareMap(trip, cacheName, options.includeMapTiles)
  const documents = getDocumentsToSave(previous, options, metadata)
  const notes = getNotesToSave(previous, options, metadata)
  const files = prepareFileManifest(
    trip,
    options,
    previous,
    media,
    notes,
    documents,
    map.urls,
  )
  const urls = new Set([
    ...(options.includeMedia ? files.media : []),
    ...(options.includeNotes ? files.notes : []),
    ...(options.includeDocuments ? files.documents : []),
  ])
  requireSameAccount(accountId)
  const total = urls.size + map.urls.length
  setInitialCacheStatus(state, trip.id, total)
  const mediaResult = await cacheOfflineMediaUrls(cacheName, [...urls], loaded => updateMediaCacheProgress(
    state,
    trip.id,
    total,
    loaded,
  ))
  requireSameAccount(accountId)
  const tileResult = await cacheOfflineMediaUrls(cacheName, map.urls, loaded => updateMediaCacheProgress(
    state,
    trip.id,
    total,
    urls.size + loaded,
  ))
  const includesTiles = shouldIncludeOfflineTiles(
    previous,
    options,
    map.urls.length,
    map.urls.length - tileResult.failedCount,
    tileResult.failedCount,
  )
  const entry = createOfflineTripEntry(
    trip,
    previous,
    getDocumentsToSave(previous, options, metadata),
    getNotesToSave(previous, options, metadata),
    urls.size,
    includesTiles,
  )
  entry.downloadedByUserId = accountId
  entry.cacheName = cacheName
  entry.media = media
  entry.files = files
  entry.unavailableCount = mediaResult.failedCount + tileResult.failedCount + metadata.failureCount + map.failed
  requireSameAccount(accountId)
  await pruneOfflineCache(cacheName, Object.values(files).flat())

  if (typeof caches !== 'undefined') {
    const cache = await caches.open(cacheName)
    await cache.put(OFFLINE_CACHE_READY_URL, Response.json({ savedAt: entry.savedAt }))
  }

  await offlineStorageService.saveTrip(entry)
  requireSameAccount(accountId)
  state.savedTrips[trip.id] = entry

  if (previous?.cacheName && typeof caches !== 'undefined')
    await caches.delete(previous.cacheName).catch(() => false)

  setOfflineSaveCompletion(
    state,
    trip,
    total,
    mediaResult.failedCount + tileResult.failedCount,
    metadata.failureCount + map.failed,
    useToast(),
  )
}

function finishOfflineDownload(state: IOfflineState, tripId: string, accountId: string) {
  if (getOfflineAccountId() !== accountId)
    return

  const completedStatus = state.downloadStatus[tripId]
  state.isDownloading[tripId] = false
  setTimeout(() => {
    if (getOfflineAccountId() !== accountId || state.downloadStatus[tripId] !== completedStatus)
      return

    delete state.downloadProgress[tripId]
    delete state.downloadStatus[tripId]

    if (state.activeProgressTripId === tripId) {
      state.activeProgressTripId = null
      state.isProgressMinimized = false
    }
  }, 1200)
}

export const useOfflineStore = defineStore('offline', {
  state: (): IOfflineState => ({
    savedTrips: {},
    accountId: getOfflineAccountId(),
    isDownloading: {},
    downloadProgress: {},
    downloadStatus: {},
    isInitialized: false,
    isProgressMinimized: false,
    activeProgressTripId: null,
  }),

  getters: {
    isTripCached: state => (tripId: string): boolean => Boolean(state.savedTrips[tripId]),
    getSavedTrip: state => (tripId: string) => state.savedTrips[tripId]?.data,
    getSavedTripNotes: state => (tripId: string) => state.savedTrips[tripId]?.notes ?? [],
    getSavedTripMedia: state => (tripId: string) => state.savedTrips[tripId]?.media ?? [],
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
      const accountId = getOfflineAccountId()

      if (this.accountId !== accountId) {
        this.$reset()
        this.accountId = accountId
      }

      if (this.isInitialized)
        return

      try {
        const trips = await offlineStorageService.loadAllTrips(accountId)

        if (getOfflineAccountId() !== accountId)
          return

        this.savedTrips = Object.fromEntries(Object.entries(trips).filter(([, entry]) => accountId && (entry.downloadedByUserId === accountId || (!entry.downloadedByUserId && entry.data.userId === accountId))).map(([id, entry]) => [id, {
          ...entry,
          downloadedByUserId: accountId ?? undefined,
          // Older snapshots contain only the legacy city labels. Keep them readable offline;
          // never try to resolve those labels against the network during hydration.
          payloadSchemaVersion: entry.payloadSchemaVersion ?? 1,
        }]))
      }
      catch (e) {
        console.warn('[OfflineStore] Ошибка инициализации IndexedDB:', e)
      }
      finally {
        if (getOfflineAccountId() === accountId)
          this.isInitialized = true
      }
    },

    openProgressDialog(tripId?: string) {
      this.isProgressMinimized = false

      if (tripId) {
        this.activeProgressTripId = tripId
      }
      else {
        const ids = Object.keys(this.isDownloading)
        const active = ids.find(id => this.isDownloading[id])

        if (active) {
          this.activeProgressTripId = active
        }
      }
    },

    minimizeProgressDialog() {
      this.isProgressMinimized = true
    },

    async saveTripByIdForOffline(tripId: string, options?: OfflineDownloadOptions) {
      if (this.isDownloading[tripId]) {
        this.openProgressDialog(tripId)

        return
      }

      const toast = useToast()

      try {
        this.isProgressMinimized = false
        this.activeProgressTripId = tripId
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
      if (this.isDownloading[trip.id]) {
        this.openProgressDialog(trip.id)

        return
      }

      const accountId = getOfflineAccountId()

      if (!accountId) {
        useToast().error('Войдите в аккаунт для сохранения поездки.')

        return
      }

      await this.initStorage()

      if (this.isDownloading[trip.id] || getOfflineAccountId() !== accountId)
        return

      const cacheName = `${getOfflineCachePrefix(accountId)}${trip.id}-${crypto.randomUUID()}`
      const downloadOpts = normalizeDownloadOptions(options)
      this.isProgressMinimized = false
      this.activeProgressTripId = trip.id
      setInitialDownloadStatus(this, trip.id, trip.title)
      const toast = useToast()

      try {
        await performOfflineDownload(
          this,
          trip,
          downloadOpts,
          accountId,
          cacheName,
        )
      }
      catch (error) {
        if (typeof caches !== 'undefined')
          await caches.delete(cacheName).catch(() => false)

        if (getOfflineAccountId() !== accountId)
          return

        console.error('[Offline] Ошибка сохранения:', error)
        this.downloadStatus[trip.id] = {
          progress: this.downloadProgress[trip.id] || 0,
          total: 0,
          loaded: 0,
          stage: 'error',
          statusText: 'Ошибка сохранения.',
          tripTitle: trip.title,
        }
        toast.error('Ошибка при сохранении оффлайн.')
      }
      finally {
        finishOfflineDownload(this, trip.id, accountId)
      }
    },

    async removeOfflineTrip(tripId: string) {
      if (!this.savedTrips[tripId])
        return

      const toast = useToast()

      try {
        const entry = this.savedTrips[tripId]

        if (entry.cacheName && typeof caches !== 'undefined')
          await caches.delete(entry.cacheName)

        await offlineStorageService.removeTrip(tripId, this.accountId)
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
