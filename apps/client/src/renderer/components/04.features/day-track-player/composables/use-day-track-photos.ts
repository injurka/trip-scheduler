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

export function useDayTrackPhotos(options: UseDayTrackPhotosOptions) {
  const { memories, galleryImages, dayData, dayStart, dayEnd } = options

  const isPhotosVisible = ref(true)
  const selectedPhoto = ref<TrackPhoto | null>(null)
  const selectedClusterPhotos = ref<TrackPhoto[]>([])

  /**
   * Вспомогательный бинарный поиск ближайшей точки трека по времени
   */
  function findPointIndexByTime(pts: DayPoint[], targetT: number): number {
    let low = 0
    let high = pts.length - 1
    let ans = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (pts[mid].tsUtc <= targetT) {
        ans = mid
        low = mid + 1
      }
      else {
        high = mid - 1
      }
    }
    return ans
  }

  /**
   * Разрешение координат для каждого фото дня
   */
  const parsedPhotos = computed(() => {
    const rawMemories = memories?.value || []
    const rawImages = galleryImages?.value || []

    const memoryMap = new Map<string, Memory>()
    for (const m of rawMemories) {
      if (m?.id) {
        memoryMap.set(m.id, m)
      }
    }

    const located: TrackPhoto[] = []
    const unlocated: Array<{
      id: string
      memoryId: string
      title?: string
      comment?: string | null
      imageUrl: string
      thumbnailUrl: string
      tsUtc: number
      originalMemory?: Memory
    }> = []

    const pts = dayData.value?.points || []

    // Если есть galleryImages — используем их как основной источник, так как в них уже разрешены превью и URL
    if (rawImages.length > 0) {
      for (const img of rawImages) {
        const meta = img.meta as Record<string, any> | undefined
        const memoryId = meta?.memoryId || img.url
        const memory = memoryId ? memoryMap.get(memoryId) : undefined

        const timeStr = meta?.takenAt || memory?.timestamp || memory?.image?.takenAt
        const tsUtc = timeStr ? new Date(timeStr).getTime() : (memory ? new Date(memory.createdAt).getTime() : 0)

        const title = memory?.title || ''
        const comment = memory?.comment || img.caption || ''
        const imageUrl = img.variants?.large || img.url
        const thumbnailUrl = img.variants?.small || img.variants?.medium || img.url
        const mediaType = img.mediaType === 'video' ? 'video' : 'image'

        // 1. Проверяем GPS из EXIF
        const gpsLat = typeof meta?.latitude === 'number' && !Number.isNaN(meta.latitude) ? meta.latitude : memory?.image?.latitude
        const gpsLng = typeof meta?.longitude === 'number' && !Number.isNaN(meta.longitude) ? meta.longitude : memory?.image?.longitude

        const hasValidGps = (
          typeof gpsLat === 'number'
          && typeof gpsLng === 'number'
          && !Number.isNaN(gpsLat)
          && !Number.isNaN(gpsLng)
          && gpsLat >= -90
          && gpsLat <= 90
          && gpsLng >= -180
          && gpsLng <= 180
          && (Math.abs(gpsLat) > 0.0001 || Math.abs(gpsLng) > 0.0001)
        )

        if (hasValidGps) {
          located.push({
            id: memoryId || img.url,
            memoryId,
            title,
            comment,
            imageUrl,
            thumbnailUrl,
            lat: gpsLat!,
            lng: gpsLng!,
            source: 'gps',
            tsUtc,
            mediaType,
            originalMemory: memory,
          })
          continue
        }

        // 2. Интерполяция по треку по времени
        if (tsUtc > 0 && pts.length > 0) {
          const idx = findPointIndexByTime(pts, tsUtc)

          if (idx >= 0 && idx < pts.length) {
            const p1 = pts[idx]

            // Остановка
            if (p1.stop && tsUtc <= (p1.stop.endedAt ?? p1.tsUtc)) {
              located.push({
                id: memoryId || img.url,
                memoryId,
                title,
                comment,
                imageUrl,
                thumbnailUrl,
                lat: p1.lat,
                lng: p1.lng,
                source: 'stop',
                tsUtc,
                mediaType,
                originalMemory: memory,
              })
              continue
            }

            // Между двумя точками трека
            if (idx < pts.length - 1) {
              const p2 = pts[idx + 1]
              const gap = p2.tsUtc - p1.tsUtc
              // Допускаем интерполяцию с разрывом до 20 минут
              if (gap <= 20 * 60 * 1000 && gap > 0) {
                const fraction = Math.max(0, Math.min(1, (tsUtc - p1.tsUtc) / gap))
                located.push({
                  id: memoryId || img.url,
                  memoryId,
                  title,
                  comment,
                  imageUrl,
                  thumbnailUrl,
                  lat: p1.lat + (p2.lat - p1.lat) * fraction,
                  lng: p1.lng + (p2.lng - p1.lng) * fraction,
                  source: 'interpolated',
                  tsUtc,
                  mediaType,
                  originalMemory: memory,
                })
                continue
              }
            }
            // Если точка в пределах 15 минут от конца записи трека
            else if (tsUtc - p1.tsUtc <= 15 * 60 * 1000) {
              located.push({
                id: memoryId || img.url,
                memoryId,
                title,
                comment,
                imageUrl,
                thumbnailUrl,
                lat: p1.lat,
                lng: p1.lng,
                source: 'interpolated',
                tsUtc,
                mediaType,
                originalMemory: memory,
              })
              continue
            }
          }
          // Если точка в пределах 15 минут до начала записи трека
          else if (idx === -1 && pts[0].tsUtc - tsUtc <= 15 * 60 * 1000) {
            located.push({
              id: memoryId || img.url,
              memoryId,
              title,
              comment,
              imageUrl,
              thumbnailUrl,
              lat: pts[0].lat,
              lng: pts[0].lng,
              source: 'interpolated',
              tsUtc,
              mediaType,
              originalMemory: memory,
            })
            continue
          }
        }

        // 3. Без геопозиции
        unlocated.push({
          id: memoryId || img.url,
          memoryId,
          title,
          comment,
          imageUrl,
          thumbnailUrl,
          tsUtc,
          originalMemory: memory,
        })
      }
    }
    // Fallback: если galleryImages не передан, но передан memories
    else if (rawMemories.length > 0) {
      for (const memory of rawMemories) {
        if (!memory.image && !memory.imageId)
          continue
        const img = memory.image
        const timeStr = memory.timestamp || img?.takenAt
        const tsUtc = timeStr ? new Date(timeStr).getTime() : new Date(memory.createdAt).getTime()
        const imageUrl = img?.variants?.large || img?.url || ''
        const thumbnailUrl = img?.variants?.small || img?.variants?.medium || img?.url || ''
        const mediaType = img?.mediaType === 'video' ? 'video' : 'image'

        const gpsLat = img?.latitude
        const gpsLng = img?.longitude
        const hasValidGps = (
          typeof gpsLat === 'number'
          && typeof gpsLng === 'number'
          && !Number.isNaN(gpsLat)
          && !Number.isNaN(gpsLng)
          && (Math.abs(gpsLat) > 0.0001 || Math.abs(gpsLng) > 0.0001)
        )

        if (hasValidGps) {
          located.push({
            id: memory.id,
            memoryId: memory.id,
            title: memory.title || '',
            comment: memory.comment || '',
            imageUrl,
            thumbnailUrl,
            lat: gpsLat!,
            lng: gpsLng!,
            source: 'gps',
            tsUtc,
            mediaType,
            originalMemory: memory,
          })
          continue
        }

        if (tsUtc > 0 && pts.length > 0) {
          const idx = findPointIndexByTime(pts, tsUtc)
          if (idx >= 0 && idx < pts.length) {
            const p1 = pts[idx]
            if (p1.stop && tsUtc <= (p1.stop.endedAt ?? p1.tsUtc)) {
              located.push({
                id: memory.id,
                memoryId: memory.id,
                title: memory.title || '',
                comment: memory.comment || '',
                imageUrl,
                thumbnailUrl,
                lat: p1.lat,
                lng: p1.lng,
                source: 'stop',
                tsUtc,
                mediaType,
                originalMemory: memory,
              })
              continue
            }
            if (idx < pts.length - 1) {
              const p2 = pts[idx + 1]
              const gap = p2.tsUtc - p1.tsUtc
              if (gap <= 20 * 60 * 1000 && gap > 0) {
                const fraction = Math.max(0, Math.min(1, (tsUtc - p1.tsUtc) / gap))
                located.push({
                  id: memory.id,
                  memoryId: memory.id,
                  title: memory.title || '',
                  comment: memory.comment || '',
                  imageUrl,
                  thumbnailUrl,
                  lat: p1.lat + (p2.lat - p1.lat) * fraction,
                  lng: p1.lng + (p2.lng - p1.lng) * fraction,
                  source: 'interpolated',
                  tsUtc,
                  mediaType,
                  originalMemory: memory,
                })
                continue
              }
            }
          }
        }

        unlocated.push({
          id: memory.id,
          memoryId: memory.id,
          title: memory.title || '',
          comment: memory.comment || '',
          imageUrl,
          thumbnailUrl,
          tsUtc,
          originalMemory: memory,
        })
      }
    }

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
