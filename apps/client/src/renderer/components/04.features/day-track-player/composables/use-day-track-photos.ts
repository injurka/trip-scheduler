import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, TrackPhoto } from '../models/types'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import { computed, ref } from 'vue'

export interface UseDayTrackPhotosOptions {
  memories?: Ref<Memory[] | undefined>
  galleryImages?: Ref<ImageViewerImage[] | undefined>
  dayData: Ref<DayData | null>
  dayStart: ComputedRef<number>
  dayEnd: ComputedRef<number>
}

type TrackPhotoBase = Omit<TrackPhoto, 'lat' | 'lng' | 'source'>

interface PhotoCandidate {
  photo: TrackPhotoBase
  latitude?: number | null
  longitude?: number | null
  strictGpsBounds: boolean
}

interface PhotoLocation {
  lat: number
  lng: number
  source: TrackPhoto['source']
}

function findPointIndexByTime(points: DayPoint[], target: number): number {
  let low = 0
  let high = points.length - 1
  let answer = -1

  while (low <= high) {
    const middle = (low + high) >> 1

    if (points[middle].tsUtc <= target) {
      answer = middle
      low = middle + 1
    }
    else {
      high = middle - 1
    }
  }

  return answer
}

function hasNumericCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && !Number.isNaN(latitude) && !Number.isNaN(longitude)
}

function isInCoordinateBounds(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function hasNonZeroCoordinates(latitude: number, longitude: number): boolean {
  return Math.abs(latitude) > 0.0001 || Math.abs(longitude) > 0.0001
}

function isValidGps(latitude: unknown, longitude: unknown, strictBounds: boolean): latitude is number {
  if (!hasNumericCoordinates(latitude, longitude))
    return false

  const numericLongitude = longitude as number
  const isInBounds = !strictBounds || isInCoordinateBounds(latitude, numericLongitude)

  return isInBounds && hasNonZeroCoordinates(latitude, numericLongitude)
}

function findInterpolatedLocation(point: DayPoint, nextPoint: DayPoint, timestamp: number): PhotoLocation | null {
  const gap = nextPoint.tsUtc - point.tsUtc

  if (gap <= 0 || gap > 20 * 60 * 1000)
    return null

  const fraction = Math.max(0, Math.min(1, (timestamp - point.tsUtc) / gap))

  return {
    lat: point.lat + (nextPoint.lat - point.lat) * fraction,
    lng: point.lng + (nextPoint.lng - point.lng) * fraction,
    source: 'interpolated',
  }
}

function findTrackLocation(
  timestamp: number,
  points: DayPoint[],
  allowBefore: boolean,
  allowAfter: boolean,
): PhotoLocation | null {
  if (timestamp <= 0 || points.length === 0)
    return null

  const index = findPointIndexByTime(points, timestamp)

  if (index === -1)
    return getLocationBeforeTrack(timestamp, points[0], allowBefore)

  const point = points[index]

  if (isDuringStop(point, timestamp))
    return { lat: point.lat, lng: point.lng, source: 'stop' }

  if (index < points.length - 1)
    return findInterpolatedLocation(point, points[index + 1], timestamp)

  return getLocationAfterTrack(timestamp, point, allowAfter)
}

function isDuringStop(point: DayPoint, timestamp: number): boolean {
  return Boolean(point.stop && timestamp <= (point.stop.endedAt ?? point.tsUtc))
}

function getLocationBeforeTrack(timestamp: number, first: DayPoint, allowBefore: boolean): PhotoLocation | null {
  return allowBefore && first.tsUtc - timestamp <= 15 * 60 * 1000
    ? { lat: first.lat, lng: first.lng, source: 'interpolated' }
    : null
}

function getLocationAfterTrack(timestamp: number, last: DayPoint, allowAfter: boolean): PhotoLocation | null {
  return allowAfter && timestamp - last.tsUtc <= 15 * 60 * 1000
    ? { lat: last.lat, lng: last.lng, source: 'interpolated' }
    : null
}

function resolvePhoto(
  candidate: PhotoCandidate,
  points: DayPoint[],
  allowBefore: boolean,
  allowAfter: boolean,
): TrackPhoto | null {
  if (isValidGps(candidate.latitude, candidate.longitude, candidate.strictGpsBounds)) {
    return {
      ...candidate.photo,
      lat: candidate.latitude,
      lng: candidate.longitude!,
      source: 'gps',
    }
  }

  const location = findTrackLocation(
    candidate.photo.tsUtc,
    points,
    allowBefore,
    allowAfter,
  )

  return location ? { ...candidate.photo, ...location } : null
}

function collectPhotos(
  candidates: PhotoCandidate[],
  points: DayPoint[],
  allowBefore: boolean,
  allowAfter: boolean,
) {
  const located: TrackPhoto[] = []
  const unlocated: TrackPhotoBase[] = []

  for (const candidate of candidates) {
    const resolved = resolvePhoto(
      candidate,
      points,
      allowBefore,
      allowAfter,
    )

    if (resolved)
      located.push(resolved)
    else
      unlocated.push(candidate.photo)
  }

  return { located, unlocated }
}

function createGalleryCandidate(image: ImageViewerImage, memoryMap: Map<string, Memory>): PhotoCandidate {
  const meta = image.meta as Record<string, any> | undefined
  const memoryId = meta?.memoryId || image.url
  const memory = memoryMap.get(memoryId)

  return {
    photo: createGalleryPhotoBase(
      image,
      memory,
      memoryId,
      meta,
    ),
    latitude: getGalleryCoordinate(meta?.latitude, memory?.image?.latitude),
    longitude: getGalleryCoordinate(meta?.longitude, memory?.image?.longitude),
    strictGpsBounds: true,
  }
}

function getGalleryCoordinate(value: unknown, fallback?: number | null): number | null | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function createGalleryPhotoBase(
  image: ImageViewerImage,
  memory: Memory | undefined,
  memoryId: string,
  meta: Record<string, any> | undefined,
): TrackPhotoBase {
  return {
    id: memoryId,
    memoryId,
    title: getMemoryTitle(memory),
    comment: getGalleryComment(memory, image),
    imageUrl: getGalleryImageUrl(image),
    thumbnailUrl: getGalleryThumbnailUrl(image),
    tsUtc: getGalleryTimestamp(meta, memory),
    mediaType: image.mediaType === 'video' ? 'video' : 'image',
    originalMemory: memory,
  }
}

function getMemoryTitle(memory?: Memory): string {
  return memory?.title || ''
}

function getGalleryComment(memory: Memory | undefined, image: ImageViewerImage): string {
  return memory?.comment || image.caption || ''
}

function getGalleryImageUrl(image: ImageViewerImage): string {
  return image.variants?.large || image.url
}

function getGalleryThumbnailUrl(image: ImageViewerImage): string {
  return image.variants?.small || image.variants?.medium || image.url
}

function getGalleryTimestamp(meta: Record<string, any> | undefined, memory?: Memory): number {
  const timeValue = meta?.takenAt || memory?.timestamp || memory?.image?.takenAt

  return timeValue ? new Date(timeValue).getTime() : (memory ? new Date(memory.createdAt).getTime() : 0)
}

function createMemoryCandidate(memory: Memory): PhotoCandidate {
  const image = memory.image

  return {
    photo: {
      id: memory.id,
      memoryId: memory.id,
      title: memory.title || '',
      comment: memory.comment || '',
      imageUrl: getMemoryImageUrl(image),
      thumbnailUrl: getMemoryThumbnailUrl(image),
      tsUtc: getMemoryTimestamp(memory),
      mediaType: getMemoryMediaType(image),
      originalMemory: memory,
    },
    latitude: getImageLatitude(image),
    longitude: getImageLongitude(image),
    strictGpsBounds: false,
  }
}

function getMemoryImageUrl(image: Memory['image']): string {
  return image?.variants?.large || image?.url || ''
}

function getMemoryThumbnailUrl(image: Memory['image']): string {
  return image?.variants?.small || image?.variants?.medium || image?.url || ''
}

function getMemoryTimestamp(memory: Memory): number {
  const timeValue = memory.timestamp || memory.image?.takenAt

  return timeValue ? new Date(timeValue).getTime() : new Date(memory.createdAt).getTime()
}

function getMemoryMediaType(image: Memory['image']): 'image' | 'video' {
  return image?.mediaType === 'video' ? 'video' : 'image'
}

function getImageLatitude(image: Memory['image']): number | null | undefined {
  return image?.latitude
}

function getImageLongitude(image: Memory['image']): number | null | undefined {
  return image?.longitude
}

function createPhotoCandidates(images: ImageViewerImage[], memories: Memory[], memoryMap: Map<string, Memory>): PhotoCandidate[] {
  if (images.length > 0)
    return images.map(image => createGalleryCandidate(image, memoryMap))

  return memories
    .filter(memory => Boolean(memory.image || memory.imageId))
    .map(createMemoryCandidate)
}

export function useDayTrackPhotos(options: UseDayTrackPhotosOptions) {
  const {
    memories,
    galleryImages,
    dayData,
    dayStart,
    dayEnd,
  } = options

  const isPhotosVisible = ref(true)
  const selectedPhoto = ref<TrackPhoto | null>(null)
  const selectedClusterPhotos = ref<TrackPhoto[]>([])

  /**
   * Разрешение координат для каждого фото дня
   */
  const parsedPhotos = computed(() => {
    const rawMemories = memories?.value || []
    const rawImages = galleryImages?.value || []
    const memoryMap = new Map<string, Memory>()

    for (const m of rawMemories) {
      if (m?.id)
        memoryMap.set(m.id, m)
    }

    const points = dayData.value?.points || []
    const candidates = createPhotoCandidates(rawImages, rawMemories, memoryMap)
    const { located, unlocated } = collectPhotos(
      candidates,
      points,
      rawImages.length > 0,
      rawImages.length > 0,
    )

    // Сортировка по времени
    located.sort((a, b) => a.tsUtc - b.tsUtc)

    return {
      located,
      unlocated,
    }
  })

  const locatedPhotos = computed(() => parsedPhotos.value.located)
  const unlocatedPhotos = computed(() => parsedPhotos.value.unlocated)
  const totalPhotosCount = computed(() => locatedPhotos.value.length + unlocatedPhotos.value.length)

  /**
   * Маркеры фотографий на таймлайне
   */
  const timelinePhotoMarkers = computed(() => {
    const photos = locatedPhotos.value
    const start = dayStart.value
    const end = dayEnd.value
    const span = end - start

    if (span <= 0 || photos.length === 0)
      return []

    return photos
      .filter(p => p.tsUtc >= start && p.tsUtc <= end)
      .map((photo) => {
        const percent = Math.max(0, Math.min(100, ((photo.tsUtc - start) / span) * 100))

        return {
          id: photo.id,
          tsUtc: photo.tsUtc,
          percent,
          photo,
        }
      })
  })

  function selectPhoto(photo: TrackPhoto | null) {
    selectedPhoto.value = photo
    selectedClusterPhotos.value = []
  }

  function selectCluster(photos: TrackPhoto[]) {
    selectedClusterPhotos.value = photos
    selectedPhoto.value = null
  }

  function closePhotoPopup() {
    selectedPhoto.value = null
    selectedClusterPhotos.value = []
  }

  return {
    isPhotosVisible,
    locatedPhotos,
    unlocatedPhotos,
    totalPhotosCount,
    timelinePhotoMarkers,
    selectedPhoto,
    selectedClusterPhotos,
    selectPhoto,
    selectCluster,
    closePhotoPopup,
  }
}
