import type { OfflineMapCoverage, OfflineMapOptions } from './offline-map-options'
import type { TripWithDays } from '~/shared/types/models/trip'
import { onlineFetch } from '~/shared/lib/connectivity'
import { getOfflineAccountId, OFFLINE_CACHE_READY_URL } from './offline-cache'
import { planOfflineMap } from './offline-map'
import { getOfflineMapStyle, getSelectedMapAreas } from './offline-map-options'

export interface OfflineMapProgress {
  title: string
  areaIndex: number
  areaCount: number
  loaded: number
  total: number
  downloadedBytes: number
}

export function requireOfflineAccount(accountId: string) {
  if (getOfflineAccountId() !== accountId)
    throw new Error('Аккаунт изменился во время скачивания.')
}

function isQuotaError(error: unknown) {
  return error instanceof Error && error.name === 'QuotaExceededError'
}

async function saveMapResource(
  cache: Cache,
  url: string,
  accountId: string,
  refresh: boolean,
  refreshed: Set<string>,
): Promise<number | null> {
  requireOfflineAccount(accountId)

  if ((!refresh || refreshed.has(url)) && await cache.match(url))
    return 0

  try {
    const response = await onlineFetch(url, { cache: 'reload', mode: 'cors', signal: AbortSignal.timeout(30000) })

    if (!response.ok)
      return null

    const bytes = (await response.clone().arrayBuffer()).byteLength
    requireOfflineAccount(accountId)
    await cache.put(url, response)
    refreshed.add(url)

    return bytes
  }
  catch (error) {
    requireOfflineAccount(accountId)

    if (isQuotaError(error))
      throw error

    return null
  }
}

async function downloadAreaResources(
  cache: Cache,
  urls: string[],
  accountId: string,
  refresh: boolean,
  refreshed: Set<string>,
  onProgress: (loaded: number, bytes: number) => void,
) {
  let loaded = 0
  let bytes = 0
  let failed = 0

  for (let offset = 0; offset < urls.length; offset += 6) {
    // Settle every writer before checkpoints/deletion, including quota failures.
    const results = await Promise.allSettled(urls.slice(offset, offset + 6).map(url => saveMapResource(
      cache,
      url,
      accountId,
      refresh,
      refreshed,
    )))

    for (const result of results) {
      if (result.status === 'rejected')
        throw result.reason

      if (result.value === null)
        failed++
      else
        bytes += result.value

      loaded++
    }

    onProgress(loaded, bytes)
  }

  return { failed, bytes }
}

/** Areas share one trip cache; every completed area is checkpointed independently. */
export async function downloadOfflineMapAreas(
  trip: TripWithDays,
  cacheName: string,
  accountId: string,
  options: OfflineMapOptions,
  onProgress: (progress: OfflineMapProgress) => void,
  onCheckpoint: (coverage: OfflineMapCoverage) => Promise<void>,
) {
  const areas = getSelectedMapAreas(trip, options)

  if (!areas.length)
    throw new Error('Выберите хотя бы одну область карты для скачивания.')

  const cache = await caches.open(cacheName)
  const settings = { ...options, style: options.style ?? getOfflineMapStyle(), maxZoom: options.maxZoom ?? 15 }
  const refreshed = new Set<string>()
  const refreshedMetadata = new Set<string>()
  let failedAreas = 0
  let downloadedBytes = 0

  for (const [index, area] of areas.entries()) {
    requireOfflineAccount(accountId)
    const report = (loaded: number, total: number, bytes = 0) => onProgress({
      title: area.title,
      areaIndex: index,
      areaCount: areas.length,
      loaded,
      total,
      downloadedBytes: downloadedBytes + bytes,
    })
    report(0, 0)

    try {
      const urls = await planOfflineMap(
        area.trip,
        cacheName,
        settings,
        refreshedMetadata,
      )

      for (const url of refreshedMetadata)
        refreshed.add(url)

      const result = await downloadAreaResources(
        cache,
        urls,
        accountId,
        Boolean(options.refresh),
        refreshed,
        (loaded, bytes) => report(loaded, urls.length, bytes),
      )
      downloadedBytes += result.bytes

      if (result.failed) {
        failedAreas++
        continue
      }

      requireOfflineAccount(accountId)
      await cache.put(OFFLINE_CACHE_READY_URL, Response.json({ savedAt: Date.now() }))
      await onCheckpoint({
        areaId: area.id,
        title: area.title,
        maxZoom: settings.maxZoom,
        style: settings.style,
        terrain: Boolean(options.terrain),
        savedAt: Date.now(),
      })
    }
    catch (error) {
      requireOfflineAccount(accountId)

      if (isQuotaError(error))
        throw new Error('Недостаточно места для карты. Скачанные участки сохранены. Освободите место или выберите меньшую детализацию и повторите загрузку.')

      failedAreas++
    }
  }

  return { failedAreas, completedAreas: areas.length - failedAreas, downloadedBytes }
}
