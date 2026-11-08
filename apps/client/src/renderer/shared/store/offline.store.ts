import type { OfflineMapCoverage, OfflineMapOptions } from '~/shared/lib/offline-map-options'
import type { TripDocumentResponse, TripNote } from '~/shared/services/api/model/types'
import type { Memory } from '~/shared/types/models/memory'
import type { TripMedia, TripSection, TripWithDays } from '~/shared/types/models/trip'
import { isRecord } from '@injurka/type-utils'
import { defineStore } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'
import { onlineFetch } from '~/shared/lib/connectivity'
import { getOfflineAccountId, getOfflineCachePrefix, OFFLINE_CACHE_READY_URL } from '~/shared/lib/offline-cache'
import { downloadOfflineMapAreas } from '~/shared/lib/offline-map-download'
import { resolveApiUrl, stripAuthTokenFromUrl } from '~/shared/lib/url'
import { isQuotaExceededError, offlineStorageService } from '~/shared/services/offline/offline-storage.service'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { useAppSettingsStore } from './app-settings.store'

const downloadAbortControllers = new Map<string, AbortController>()

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException('Загрузка отменена пользователем.', 'AbortError')
}

export interface OfflineTripEntry {
  /** Version of the serialized trip payload, independent of IndexedDB schema version. */
  downloadedByUserId?: string
  cacheName?: string
  mapCacheName?: string
  mapPending?: boolean
  mapCoverage?: OfflineMapCoverage[]
  mapOptions?: OfflineMapOptions
  files?: Record<'media' | 'notes' | 'documents' | 'map', string[]>
  media?: TripMedia[]
  memories?: Memory[]
  sizeBytes?: number
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
  map?: OfflineMapOptions
}

type NormalizedOfflineDownloadOptions = Required<Omit<OfflineDownloadOptions, 'map'>> & Pick<OfflineDownloadOptions, 'map'>

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

function collectFinancesMedia(content: Record<string, unknown>, urls: Set<string>) {
  if (!Array.isArray(content.transactions))
    return

  for (const tx of content.transactions.filter(isRecord)) {
    if (Array.isArray(tx.photos))
      tx.photos.forEach(url => addOfflineUrl(urls, url))
  }
}

function collectMediaSectionUrls(section: unknown, urls: Set<string>) {
  if (!isRecord(section))
    return

  const content = isRecord(section.content) ? section.content : {}

  if (section.type === 'gallery' && Array.isArray(content.imageUrls))
    content.imageUrls.forEach((url: string) => addOfflineUrl(urls, url))

  collectBookingMedia(content, urls)
  collectFinancesMedia(content, urls)

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
  options: NormalizedOfflineDownloadOptions,
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
  memories: Memory[]
  memoriesFetchSuccess: boolean
  failureCount: number
}

async function fetchOfflineMetadata(tripId: string, options: NormalizedOfflineDownloadOptions): Promise<OfflineMetadataResult> {
  const [notesResult, documentsResult, memoriesResult] = await Promise.all([
    options.includeNotes ? fetchOfflineNotes(tripId) : Promise.resolve({ items: [], success: false, failed: 0 }),
    options.includeDocuments ? fetchOfflineDocuments(tripId) : Promise.resolve({ items: [], success: false, failed: 0 }),
    options.includeMedia ? fetchOfflineMemories(tripId) : Promise.resolve({ items: [], success: false, failed: 0 }),
  ])

  return {
    notes: notesResult.items,
    notesFetchSuccess: notesResult.success,
    documents: documentsResult.items,
    documentsFetchSuccess: documentsResult.success,
    memories: memoriesResult.items,
    memoriesFetchSuccess: memoriesResult.success,
    failureCount: notesResult.failed + documentsResult.failed + memoriesResult.failed,
  }
}

async function fetchOfflineMemories(tripId: string) {
  if (!trpc.memory?.getByTripId?.query) {
    return { items: [] as Memory[], success: false, failed: 0 }
  }

  try {
    const memories: unknown = await trpc.memory.getByTripId.query({ tripId })

    if (Array.isArray(memories))
      return { items: memories as unknown as Memory[], success: true, failed: 0 }

    console.warn('[Offline] Не удалось загрузить свежие воспоминания: некорректный ответ')

    return { items: [] as Memory[], success: false, failed: 1 }
  }
  catch (error) {
    console.warn('[Offline] Не удалось загрузить свежие воспоминания:', error)

    return { items: [] as Memory[], success: false, failed: 1 }
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

// eslint-disable-next-line complexity
async function cacheOfflineUrl(
  cache: Cache,
  rawUrl: string,
  accountId: string | null,
  signal?: AbortSignal,
): Promise<{ success: boolean, bytes: number }> {
  const url = resolveApiUrl(rawUrl)
  const cleanUrl = stripAuthTokenFromUrl(url)

  try {
    throwIfAborted(signal)
    const fetchSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000)
    const response = await onlineFetch(url, { mode: 'cors', cache: 'reload', signal: fetchSignal })

    if (!response.ok || response.type === 'opaque')
      return { success: false, bytes: 0 }

    if (getOfflineAccountId() !== accountId)
      return { success: false, bytes: 0 }

    throwIfAborted(signal)

    const contentLengthHeader = response.headers.get('content-length')
    const parsedLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : Number.NaN
    const bytes = Number.isFinite(parsedLength) && parsedLength >= 0
      ? parsedLength
      : (await response.clone().blob()).size

    await cache.put(cleanUrl, response)

    return { success: true, bytes }
  }
  catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw new DOMException('Загрузка отменена пользователем.', 'AbortError')
    }

    if (isQuotaExceededError(error)) {
      const quotaError = new Error('Недостаточно свободного места на устройстве для кэширования файлов. Освободите память и попробуйте снова.')
      quotaError.name = 'QuotaExceededError'
      throw quotaError
    }

    return { success: false, bytes: 0 }
  }
}

interface CacheResult {
  loadedCount: number
  failedCount: number
  totalBytes: number
}

async function cacheOfflineMediaUrls(
  cacheName: string,
  urls: string[],
  onProgress: (loadedCount: number) => void,
  signal?: AbortSignal,
): Promise<CacheResult> {
  const accountId = getOfflineAccountId()
  let loadedCount = 0
  let failedCount = 0
  let totalBytes = 0

  try {
    if (typeof caches === 'undefined')
      throw new Error('Cache Storage API недоступен')

    const cache = await caches.open(cacheName)

    for (let offset = 0; offset < urls.length; offset += 4) {
      throwIfAborted(signal)

      if (getOfflineAccountId() !== accountId)
        throw new Error('Аккаунт изменился во время скачивания.')

      const results = await Promise.all(urls.slice(offset, offset + 4).map(url => cacheOfflineUrl(
        cache,
        url,
        accountId,
        signal,
      )))

      results.forEach(({ success, bytes }) => {
        if (!success)
          failedCount++
        else
          totalBytes += bytes

        loadedCount++

        if (getOfflineAccountId() === accountId)
          onProgress(loadedCount)
      })
    }
  }
  catch (error) {
    if (isAbortError(error) || isQuotaExceededError(error)) {
      throw error
    }

    console.warn('[Offline] caches API error:', error)
    const remaining = urls.length - loadedCount
    failedCount += remaining
    loadedCount += remaining

    if (remaining > 0 && getOfflineAccountId() === accountId)
      onProgress(loadedCount)
  }

  return { loadedCount, failedCount, totalBytes }
}

function normalizeDownloadOptions(options?: OfflineDownloadOptions): NormalizedOfflineDownloadOptions {
  return {
    includeMedia: options?.includeMedia ?? true,
    includeNotes: options?.includeNotes ?? true,
    includeDocuments: options?.includeDocuments ?? true,
    includeMapTiles: options?.includeMapTiles ?? false,
    map: options?.map,
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
  maxProgress = 100,
) {
  const progress = Math.min(maxProgress, Math.round((loaded / totalCount) * maxProgress))
  state.downloadProgress[tripId] = progress
  state.downloadStatus[tripId] = {
    progress,
    total: totalCount,
    loaded,
    stage: 'caching',
    statusText: `Кэширование файлов (${loaded}/${totalCount})...`,
  }
}

function getDocumentsToSave(current: OfflineTripEntry | undefined, options: NormalizedOfflineDownloadOptions, metadata: OfflineMetadataResult): TripDocumentResponse[] {
  if (options.includeDocuments && metadata.documentsFetchSuccess)
    return metadata.documents

  return current?.documents ?? []
}

function getNotesToSave(current: OfflineTripEntry | undefined, options: NormalizedOfflineDownloadOptions, metadata: OfflineMetadataResult): TripNote[] {
  if (options.includeNotes && metadata.notesFetchSuccess)
    return metadata.notes

  return current?.notes ?? []
}

function getMemoriesToSave(current: OfflineTripEntry | undefined, options: NormalizedOfflineDownloadOptions, metadata: OfflineMetadataResult): Memory[] {
  if (options.includeMedia && metadata.memoriesFetchSuccess)
    return metadata.memories

  return current?.memories ?? []
}

function createOfflineTripEntry(
  trip: TripWithDays,
  current: OfflineTripEntry | undefined,
  documents: TripDocumentResponse[],
  notes: TripNote[],
  memories: Memory[],
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
    memories,
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
  if (!previous?.cacheName || previous.cacheName === cacheName || typeof caches === 'undefined')
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
  options: NormalizedOfflineDownloadOptions,
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

interface OfflineDownloadSession {
  cacheName: string
  committed: boolean
}

async function commitOfflineEntry(state: IOfflineState, entry: OfflineTripEntry, accountId: string) {
  requireSameAccount(accountId)
  await offlineStorageService.saveTrip(entry)
  requireSameAccount(accountId)
  state.savedTrips[entry.id] = entry
}

async function saveTripMapAreas(
  state: IOfflineState,
  entry: OfflineTripEntry,
  accountId: string,
  options: OfflineMapOptions,
  signal?: AbortSignal,
) {
  const baseFailures = entry.unavailableCount ?? 0
  const result = await downloadOfflineMapAreas(
    entry.data,
    entry.mapCacheName!,
    accountId,
    options,
    (part) => {
      throwIfAborted(signal)
      requireSameAccount(accountId)
      const fraction = part.total ? part.loaded / part.total : 0
      const progress = Math.round(10 + 89 * (part.areaIndex + fraction) / part.areaCount)
      state.downloadProgress[entry.id] = progress
      state.downloadStatus[entry.id] = {
        progress,
        total: part.total,
        loaded: part.loaded,
        stage: 'caching',
        statusText: `Карта: ${part.title} (${part.areaIndex + 1}/${part.areaCount}), ${part.loaded}/${part.total}. Скачано ${(part.downloadedBytes / 1024 / 1024).toFixed(1)} МБ`,
        tripTitle: entry.title,
      }
    },
    async (coverage) => {
      throwIfAborted(signal)
      entry.mapCoverage = [...(entry.mapCoverage ?? []).filter(item => item.areaId !== coverage.areaId || item.style !== coverage.style || item.terrain !== coverage.terrain), coverage]
      await commitOfflineEntry(state, entry, accountId)
    },
  )

  if (result.completedAreas > 0 && options.style)
    useAppSettingsStore().activeTileSource = options.style

  entry.mapPending = result.failedAreas > 0
  entry.includesTiles = result.completedAreas > 0 && result.failedAreas === 0
  entry.unavailableCount = baseFailures + result.failedAreas
  entry.sizeBytes = (entry.sizeBytes ?? 0) + result.downloadedBytes
  await commitOfflineEntry(state, entry, accountId)

  return result.failedAreas
}

function getRequestedFileUrls(options: NormalizedOfflineDownloadOptions, files: NonNullable<OfflineTripEntry['files']>) {
  return new Set([
    ...(options.includeMedia ? files.media : []),
    ...(options.includeNotes ? files.notes : []),
    ...(options.includeDocuments ? files.documents : []),
  ])
}

function configureEntryMap(entry: OfflineTripEntry, accountId: string, options: NormalizedOfflineDownloadOptions) {
  if (!options.includeMapTiles)
    return

  entry.mapCacheName ??= `${getOfflineCachePrefix(accountId)}${entry.id}-map`
  entry.mapOptions = options.map ?? {}
  entry.mapPending = true
  entry.includesTiles = false
}

async function commitBaseEntry(
  state: IOfflineState,
  entry: OfflineTripEntry,
  previous: OfflineTripEntry | undefined,
  accountId: string,
  session: OfflineDownloadSession,
) {
  requireSameAccount(accountId)
  await pruneOfflineCache(session.cacheName, Object.values(entry.files ?? {}).flat())

  if (typeof caches !== 'undefined') {
    const cache = await caches.open(session.cacheName)
    await cache.put(OFFLINE_CACHE_READY_URL, Response.json({ savedAt: entry.savedAt }))
  }

  await commitOfflineEntry(state, entry, accountId)
  session.committed = true

  if (previous?.cacheName && previous.cacheName !== session.cacheName && typeof caches !== 'undefined')
    await caches.delete(previous.cacheName).catch(() => false)
}

function createOfflineSession(
  state: IOfflineState,
  tripId: string,
  accountId: string,
  options: NormalizedOfflineDownloadOptions,
) {
  const onlyMap = !options.includeMedia && !options.includeNotes && !options.includeDocuments
  const existingCache = onlyMap ? state.savedTrips[tripId]?.cacheName : undefined
  const cacheName = existingCache ?? `${getOfflineCachePrefix(accountId)}${tripId}-${crypto.randomUUID()}`

  return { cacheName, committed: Boolean(existingCache) }
}

async function performOfflineDownload(
  state: IOfflineState,
  trip: TripWithDays,
  options: NormalizedOfflineDownloadOptions,
  accountId: string,
  session: OfflineDownloadSession,
  signal?: AbortSignal,
) {
  const cacheName = session.cacheName
  const previous = state.savedTrips[trip.id]
  throwIfAborted(signal)
  await copyOfflineCache(previous, cacheName)
  throwIfAborted(signal)
  const metadata = await fetchOfflineMetadata(trip.id, options)
  throwIfAborted(signal)
  const media = await prepareMedia(
    trip.id,
    options.includeMedia,
    previous,
    metadata,
  )
  const documents = getDocumentsToSave(previous, options, metadata)
  const notes = getNotesToSave(previous, options, metadata)
  const memories = getMemoriesToSave(previous, options, metadata)
  const files = prepareFileManifest(
    trip,
    options,
    previous,
    media,
    notes,
    documents,
    [],
  )
  const urls = getRequestedFileUrls(options, files)
  throwIfAborted(signal)
  requireSameAccount(accountId)
  setInitialCacheStatus(state, trip.id, urls.size)
  const mediaResult = await cacheOfflineMediaUrls(
    cacheName,
    [...urls],
    loaded => updateMediaCacheProgress(
      state,
      trip.id,
      urls.size,
      loaded,
      options.includeMapTiles ? 10 : 100,
    ),
    signal,
  )
  throwIfAborted(signal)
  const entry = createOfflineTripEntry(
    trip,
    previous,
    documents,
    notes,
    memories,
    urls.size,
    Boolean(previous?.includesTiles),
  )
  entry.downloadedByUserId = accountId
  entry.cacheName = cacheName
  entry.media = media
  entry.files = files
  entry.unavailableCount = mediaResult.failedCount + metadata.failureCount
  entry.sizeBytes = mediaResult.totalBytes

  configureEntryMap(entry, accountId, options)
  await commitBaseEntry(
    state,
    entry,
    previous,
    accountId,
    session,
  )
  const mapFailures = options.includeMapTiles
    ? await saveTripMapAreas(
        state,
        entry,
        accountId,
        options.map ?? {},
        signal,
      )
    : 0
  setOfflineSaveCompletion(
    state,
    trip,
    urls.size,
    mediaResult.failedCount,
    metadata.failureCount + mapFailures,
    useToast(),
  )
}

async function handleOfflineDownloadError(
  state: IOfflineState,
  trip: TripWithDays,
  accountId: string,
  session: OfflineDownloadSession,
  error: unknown,
) {
  if (!session.committed && typeof caches !== 'undefined')
    await caches.delete(session.cacheName).catch(() => false)

  if (getOfflineAccountId() !== accountId)
    return

  if (isAbortError(error)) {
    delete state.downloadProgress[trip.id]
    delete state.downloadStatus[trip.id]
    useToast().info('Скачивание офлайн-пакета отменено.')

    return
  }

  const message = isQuotaExceededError(error)
    ? (error instanceof Error && /\p{Script=Cyrillic}/u.test(error.message)
        ? error.message
        : 'Недостаточно свободного места на устройстве для сохранения офлайн-пакета. Освободите память и попробуйте снова.')
    : (error instanceof Error ? error.message : 'Ошибка при сохранении оффлайн.')
  state.downloadStatus[trip.id] = {
    progress: state.downloadProgress[trip.id] || 0,
    total: 0,
    loaded: 0,
    stage: 'error',
    statusText: message,
    tripTitle: trip.title,
  }
  useToast().error(message)
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
    getSavedTripMemories: state => (tripId: string) => state.savedTrips[tripId]?.memories ?? [],
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

    cancelOfflineDownload(tripId?: string) {
      const targetId = tripId
        || this.activeProgressTripId
        || Object.keys(this.isDownloading).find(id => this.isDownloading[id])

      if (!targetId)
        return

      const controller = downloadAbortControllers.get(targetId)

      if (controller) {
        controller.abort()
        downloadAbortControllers.delete(targetId)
      }

      this.isDownloading[targetId] = false
      delete this.downloadProgress[targetId]
      delete this.downloadStatus[targetId]

      if (this.activeProgressTripId === targetId) {
        this.activeProgressTripId = null
        this.isProgressMinimized = false
      }
    },

    async syncSavedTripSections(tripId: string, sections: TripSection[]) {
      const entry = this.savedTrips[tripId]

      if (!entry)
        return

      const clonedSections = JSON.parse(JSON.stringify(sections)) as TripSection[]
      const updatedEntry: OfflineTripEntry = {
        ...entry,
        data: {
          ...entry.data,
          sections: clonedSections,
        },
      }
      this.savedTrips[tripId] = updatedEntry

      try {
        await offlineStorageService.saveTrip(updatedEntry)
      }
      catch (e) {
        console.warn('[OfflineStore] Ошибка синхронизации секций в офлайн-хранилище:', e)
      }
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

      const downloadOpts = normalizeDownloadOptions(options)
      const session = createOfflineSession(
        this,
        trip.id,
        accountId,
        downloadOpts,
      )
      const abortController = new AbortController()
      downloadAbortControllers.set(trip.id, abortController)
      this.isProgressMinimized = false
      this.activeProgressTripId = trip.id
      setInitialDownloadStatus(this, trip.id, trip.title)

      try {
        await performOfflineDownload(
          this,
          trip,
          downloadOpts,
          accountId,
          session,
          abortController.signal,
        )
      }
      catch (error) {
        await handleOfflineDownloadError(
          this,
          trip,
          accountId,
          session,
          error,
        )
      }
      finally {
        if (downloadAbortControllers.get(trip.id) === abortController)
          downloadAbortControllers.delete(trip.id)

        finishOfflineDownload(this, trip.id, accountId)
      }
    },

    async removeOfflineTrip(tripId: string) {
      if (!this.savedTrips[tripId])
        return

      const toast = useToast()

      try {
        const entry = this.savedTrips[tripId]

        if (typeof caches !== 'undefined') {
          for (const name of [entry.cacheName, entry.mapCacheName]) {
            if (name)
              await caches.delete(name)
          }
        }

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
