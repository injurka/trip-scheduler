import type { TripMedia } from '~/shared/types/models/trip'
import { invoke } from '@tauri-apps/api/core'
import { resolveApiUrl } from '~/shared/lib/url'

export interface MemoryExportProgress {
  isDownloading: boolean
  current: number
  total: number
  loadedBytes: number
}

export function memoryExportName(image: Pick<TripMedia, 'id' | 'originalName' | 'name'>, prefix: string): string {
  const original = image.originalName || image.name || `${image.id}.jpg`
  let name = original.replace(/[<>:"/\\|?*]/g, '_').replace(/\p{Cc}/gu, '_').replace(/\.{2,}/g, '_').replace(/[. ]+$/g, '')
  const encoder = new TextEncoder()

  // Filesystems limit bytes, rather than JS string length; retain the extension.
  while (encoder.encode(name).length > 180)
    name = Array.from(name).slice(1).join('')

  return `${prefix}-${name}`
}

export async function exportMemoryFiles(media: TripMedia[], folder: string, progress: MemoryExportProgress): Promise<number> {
  let failed = 0

  for (const image of media) {
    const exportId = image.id.slice(0, 8)

    try {
      progress.loadedBytes += await invoke<number>('memory_export_file', {
        folder,
        url: resolveApiUrl(image.url),
        fileName: memoryExportName(image, `${exportId}-${progress.current + 1}`),
        mimeType: image.fileType || 'application/octet-stream',
      })
    }
    catch (error) {
      failed++
      console.error('Memory export failed:', image.id, error)
    }
    finally {
      progress.current++
    }
  }

  return failed
}
