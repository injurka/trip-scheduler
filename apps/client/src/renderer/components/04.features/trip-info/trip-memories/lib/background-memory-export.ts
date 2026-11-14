import type { MemoryExportProgress } from './export-memories'
import type { TripMedia } from '~/shared/types/models/trip'
import { invoke } from '@tauri-apps/api/core'
import { resolveApiUrl } from '~/shared/lib/url'
import { memoryExportName } from './export-memories'

export interface BackgroundMemoryExportStatus extends MemoryExportProgress {
  id?: string
  failed: number
  cancelled: boolean
  error?: string | null
}

export async function startBackgroundMemoryExport(media: TripMedia[]) {
  const allowed = await invoke<boolean>('tracking_request_notification_permission')

  if (!allowed)
    throw new Error('Разрешите уведомления для фонового скачивания воспоминаний')

  await invoke<boolean>('memory_export_start', {
    files: media.map(image => ({
      url: resolveApiUrl(image.url),
      fileName: memoryExportName(image, image.id),
      mimeType: image.fileType || 'application/octet-stream',
    })),
  })
}

export async function observeBackgroundMemoryExport(progress: MemoryExportProgress, initial: BackgroundMemoryExportStatus): Promise<BackgroundMemoryExportStatus> {
  let status = initial

  while (true) {
    if (!status.id || (initial.id && status.id !== initial.id))
      throw new Error('Фоновое скачивание прервано. Повторите скачивание оставшихся файлов.')

    Object.assign(progress, {
      isDownloading: status.isDownloading,
      current: status.current,
      total: status.total,
      loadedBytes: status.loadedBytes,
      skippedCount: status.skippedCount ?? 0,
    })

    if (!status.isDownloading)
      return status

    // This only mirrors native state. Suspending JS cannot suspend the download.
    await new Promise(resolve => setTimeout(resolve, 750))
    status = await invoke<BackgroundMemoryExportStatus>('memory_export_status')
  }
}
