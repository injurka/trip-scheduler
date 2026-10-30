import type { PostMedia } from '~/shared/types/models/post'
import exifr from 'exifr'

export interface TimelineMedia {
  file?: File
  media?: PostMedia
  capturedAt: string
  source: 'exif' | 'video' | 'filename' | 'metadata' | 'unknown'
  latitude?: number
  longitude?: number
}
export interface MediaGroup {
  items: TimelineMedia[]
  title: string
  date: string
  time: string
}

function localTimestamp(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

// Seek ISO BMFF boxes instead of reading a potentially multi-gigabyte video into memory.
export async function videoCreationDate(file: Blob): Promise<Date | undefined> {
  interface BoxHeader {
    data: DataView
    type: string
    size: number
    headerSize: number
  }

  async function readBox(offset: number, end: number): Promise<BoxHeader | undefined> {
    const data = new DataView(await file.slice(offset, offset + 40).arrayBuffer())
    let size = data.getUint32(0)
    const type = String.fromCharCode(...new Uint8Array(data.buffer, 4, 4))
    let headerSize = 8

    if (size === 1) {
      if (data.byteLength < 16)
        return

      size = Number(data.getBigUint64(8))
      headerSize = 16
    }

    if (size === 0)
      size = end - offset

    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > end)
      return

    return { data, type, size, headerSize }
  }

  function parseMovieHeaderDate(box: BoxHeader): Date | undefined {
    const { data, headerSize } = box

    if (data.byteLength < headerSize + 12)
      return

    const seconds = data.getUint8(headerSize) === 1
      ? Number(data.getBigUint64(headerSize + 4))
      : data.getUint32(headerSize + 4)

    if (!seconds)
      return

    const date = new Date((seconds - 2082844800) * 1000)

    return Number.isFinite(date.getTime()) ? date : undefined
  }

  async function scan(start: number, end: number, depth = 0): Promise<Date | undefined> {
    if (depth > 2)
      return

    for (let offset = start, count = 0; offset + 8 <= end && count < 4096; count++) {
      const box = await readBox(offset, end)

      if (!box)
        return

      if (box.type === 'mvhd')
        return parseMovieHeaderDate(box)

      if (box.type === 'moov') {
        const date = await scan(offset + box.headerSize, offset + box.size, depth + 1)

        if (date)
          return date
      }

      offset += box.size
    }
  }

  return scan(0, file.size)
}

export async function readTimelineMedia(file: File): Promise<TimelineMedia> {
  const result: TimelineMedia = { file, capturedAt: '', source: 'unknown' }

  try {
    if (isVideoFile(file))
      await readVideoMetadata(file, result)
    else
      await readImageMetadata(file, result)
  }
  catch { /* Unsupported/stripped metadata: try the camera filename below. */ }

  if (!result.capturedAt) {
    const value = captureTimestampFromFilename(file.name)

    if (value) {
      result.capturedAt = value
      result.source = 'filename'
    }
  }

  return result
}

function isVideoFile(file: Pick<File, 'type' | 'name'>): boolean {
  return file.type.startsWith('video/') || /\.(?:mp4|mov|m4v)$/i.test(file.name)
}

async function readVideoMetadata(file: File, result: TimelineMedia) {
  const date = await videoCreationDate(file)

  if (!date)
    return

  result.capturedAt = localTimestamp(date)
  result.source = 'video'
}

async function readImageMetadata(file: File, result: TimelineMedia) {
  const meta = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'] })
  const date = meta?.DateTimeOriginal || meta?.CreateDate

  if (date instanceof Date && Number.isFinite(date.getTime())) {
    result.capturedAt = localTimestamp(date)
    result.source = 'exif'
  }

  result.latitude = meta?.latitude
  result.longitude = meta?.longitude
}

function captureTimestampFromFilename(name: string): string {
  const match = name.match(/(?:^|\D)(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[T_ -]?(\d{2})[._:-]?(\d{2})[._:-]?(\d{2})\d{0,3}(?:\D|$)/)

  if (!match)
    return ''

  const [, y, m, d, h, min, sec] = match
  const value = `${y}-${m}-${d}T${h}:${min}:${sec}`
  const date = new Date(value)

  return Number.isFinite(date.getTime()) && localTimestamp(date) === value ? value : ''
}

export function readStoredTimelineMedia(media: PostMedia): TimelineMedia {
  const metadata = media.metadata || {}
  const value = getStoredMediaTimestamp(media, metadata)

  const filenameTime = !value ? captureTimestampFromFilename(media.originalName || '') : ''

  return {
    media,
    capturedAt: value || filenameTime,
    source: getStoredMediaSource(value, filenameTime),
    latitude: media.latitude ?? metadata.latitude,
    longitude: media.longitude ?? metadata.longitude,
  }
}

function getStoredMediaTimestamp(media: PostMedia, metadata: NonNullable<PostMedia['metadata']>): string {
  return getStoredCaptureTimestamp(metadata.capturedAt || getNestedCaptureTimestamp(metadata))
    || getStoredCaptureTimestamp(media.takenAt || metadata.takenAt, true)
}

function getNestedCaptureTimestamp(metadata: NonNullable<PostMedia['metadata']>): unknown {
  return metadata.metadata?.capturedAt
}

function getStoredMediaSource(value: string, filenameTime: string): TimelineMedia['source'] {
  if (value)
    return 'metadata'

  return filenameTime ? 'filename' : 'unknown'
}

function getStoredCaptureTimestamp(value: unknown, localize = false): string {
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime()))
    return ''

  return localize ? localTimestamp(new Date(value)) : value
}

function distanceKm(a: TimelineMedia, b: TimelineMedia): number {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
    return 0

  const rad = Math.PI / 180
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2

  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function groupTimelineMedia(items: TimelineMedia[], gapMinutes = 60): MediaGroup[] {
  const sorted = items.filter(item => item.capturedAt).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
  const groups: MediaGroup[] = []

  for (const item of sorted) {
    const last = groups.at(-1)
    const previous = last?.items.at(-1)
    const time = new Date(item.capturedAt).getTime()

    if (shouldStartMediaGroup(
      item,
      time,
      last,
      previous,
      gapMinutes,
    )) {
      groups.push({ items: [item], title: '', date: item.capturedAt.slice(0, 10), time: item.capturedAt.slice(11, 16) })
    }
    else {
      last!.items.push(item)
    }
  }

  const unknown = items.filter(item => !item.capturedAt)

  if (unknown.length)
    groups.push({ items: unknown, title: '', date: '', time: '' })

  return groups
}

function shouldStartMediaGroup(
  item: TimelineMedia,
  time: number,
  last: MediaGroup | undefined,
  previous: TimelineMedia | undefined,
  gapMinutes: number,
): boolean {
  if (!last || !previous)
    return true

  return last.date !== item.capturedAt.slice(0, 10)
    || time - new Date(previous.capturedAt).getTime() > gapMinutes * 60000
    || time - new Date(last.items[0].capturedAt).getTime() > 3 * 3600000
    || distanceKm(previous, item) > 2
}

// Use only photos, preferring those near the middle of the group.
export async function prepareGroupAnalysisFrame(group: MediaGroup, loadFrame: (path: string) => Promise<string | undefined>): Promise<string | undefined> {
  const middle = Math.floor(group.items.length / 2)
  const candidates = getImageCandidates(group, middle)
  const attempted = new Set<string>()

  for (const { media } of candidates) {
    const frame = await tryLoadMediaFrame(media, attempted, loadFrame)

    if (frame)
      return frame
  }
}

function getImageCandidates(group: MediaGroup, middle: number) {
  return group.items.map((item, index) => ({ media: item.media, index }))
    .filter(item => item.media?.type === 'image')
    .sort((a, b) => Math.abs(a.index - middle) - Math.abs(b.index - middle))
}

async function tryLoadMediaFrame(media: PostMedia | undefined, attempted: Set<string>, loadFrame: (path: string) => Promise<string | undefined>): Promise<string | undefined> {
  if (!media)
    return

  for (const path of getMediaPreviewPaths(media)) {
    if (!path || attempted.has(path))
      continue

    attempted.add(path)

    try {
      const frame = await loadFrame(path)

      if (frame)
        return frame
    }
    catch { /* Try the next preview or file in this group. */ }
  }
}

function getMediaPreviewPaths(media: PostMedia): Array<string | undefined> {
  return [
    getPreviewVariant(media, 'poster'),
    getPreviewVariant(media, 'small'),
    getPreviewVariant(media, 'medium'),
    media.type === 'image' ? media.url : undefined,
  ]
}

function getPreviewVariant(media: PostMedia, size: 'poster' | 'small' | 'medium'): string | undefined {
  return media.variants?.[size] || media.metadata?.variants?.[size]
}

// A single small frame per group; videos themselves never go to the model.
export async function createAnalysisFrame(file: Blob & { name?: string }): Promise<string | undefined> {
  const url = URL.createObjectURL(file)
  const video = isAnalysisVideo(file)
  const media = video ? document.createElement('video') : new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview timeout')), 10000)
      const ready = () => {
        clearTimeout(timer)
        resolve()
      }
      media.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Unsupported media'))
      }

      setMediaLoadHandler(media, ready)
      media.src = url
    })
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight

    if (!width || !height)
      return

    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 384 / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')

    if (!ctx)
      return

    ctx.drawImage(
      media,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    return canvas.toDataURL('image/jpeg', 0.55)
  }
  catch { return undefined }
  finally {
    media.removeAttribute('src')

    if (media instanceof HTMLVideoElement)
      media.load()

    URL.revokeObjectURL(url)
  }
}

function isAnalysisVideo(file: Blob & { name?: string }): boolean {
  return file.type.startsWith('video/') || /\.(?:mp4|mov|m4v|webm)$/i.test(file.name || '')
}

function setMediaLoadHandler(media: HTMLVideoElement | HTMLImageElement, ready: () => void) {
  if (media instanceof HTMLVideoElement) {
    media.muted = true
    media.preload = 'auto'
    media.onloadeddata = ready

    return
  }

  media.onload = ready
}
