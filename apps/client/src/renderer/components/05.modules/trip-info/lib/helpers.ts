import type { IActivity } from '../models/types'
import type { IImageViewerImageMeta, ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import type { TripMedia } from '~/shared/types/models/trip'
import { EActivityTag } from '../models/types'

export function getActivityDuration(activity: IActivity): number {
  return timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)
}

export const activityTagIcons: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: 'mdi-car',
  [EActivityTag.WALK]: 'mdi-walk',
  [EActivityTag.FOOD]: 'mdi-food',
  [EActivityTag.ATTRACTION]: 'mdi-camera',
  [EActivityTag.RELAX]: 'mdi-bed',
  [EActivityTag.ACTIVITY]: 'mdi-label-outline',
}

export const activityTagColors: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: '#A2D2FF80',
  [EActivityTag.WALK]: '#B9FBC080',
  [EActivityTag.FOOD]: '#FFD6A580',
  [EActivityTag.ATTRACTION]: '#E0BBE480',
  [EActivityTag.RELAX]: '#A0E7E580',
  [EActivityTag.ACTIVITY]: '#CFD8DC80',
}

export const activityTagLabels: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: 'Транспорт',
  [EActivityTag.WALK]: 'Прогулка',
  [EActivityTag.FOOD]: 'Еда',
  [EActivityTag.ATTRACTION]: 'Достопримечательность',
  [EActivityTag.RELAX]: 'Отдых',
  [EActivityTag.ACTIVITY]: 'Активность',
}

export interface CustomImageViewerImageMeta extends IImageViewerImageMeta {
  memoryId?: string
  imageId: string
}

/**
 * Возвращает полную информацию о теге (иконка, цвет, название).
 * @param tag - Тег активности.
 * @returns Объект с информацией о теге или null.
 */
export function getTagInfo(tag?: EActivityTag) {
  if (!tag)
    return null

  return {
    value: tag,
    icon: activityTagIcons[tag],
    color: activityTagColors[tag],
    label: activityTagLabels[tag],
  }
}

/**
 * Преобразует объект TripMedia в формат, необходимый для kit-image-viewer.
 * @param media - Объект TripMedia.
 * @returns Объект ImageViewerImage.
 */
export function tripMediaToViewerImage(media: TripMedia): ImageViewerImage {
  const meta: CustomImageViewerImageMeta = {
    ...(media.metadata || {}),
    latitude: media.latitude,
    longitude: media.longitude,
    takenAt: media.takenAt,
    width: media.width,
    height: media.height,
    imageId: media.id,
  }

  return {
    url: media.variants?.large || media.variants?.web || media.url,
    mediaType: media.mediaType || 'image',
    variants: media.variants as any,
    alt: media.metadata?.iptc?.headline || 'Trip Media',
    caption: media.metadata?.iptc?.caption,
    meta,
  }
}

export const tripImageToViewerImage = tripMediaToViewerImage

/**
 * Преобразует объект Memory (содержащий TripMedia) в формат для kit-image-viewer.
 * @param memory - Объект Memory.
 * @returns Объект ImageViewerImage или null, если медиа отсутствует.
 */
export function memoryToViewerImage(memory: Memory): ImageViewerImage | null {
  if (!memory.image) {
    return null
  }
  const viewerImage = tripMediaToViewerImage(memory.image)

  viewerImage.alt = memory.comment || viewerImage.alt
  viewerImage.caption = memory.comment || viewerImage.caption

  if (viewerImage.meta) {
    (viewerImage.meta as CustomImageViewerImageMeta).memoryId = memory.id
  }

  return viewerImage
}

const VALID_TAGS = new Set(Object.values(EActivityTag))

const ClientTagSynonyms: Record<string, EActivityTag> = {
  transport: EActivityTag.TRANSPORT,
  транспорт: EActivityTag.TRANSPORT,
  дорога: EActivityTag.TRANSPORT,
  переезд: EActivityTag.TRANSPORT,
  поездка: EActivityTag.TRANSPORT,
  трансфер: EActivityTag.TRANSPORT,
  transfer: EActivityTag.TRANSPORT,
  drive: EActivityTag.TRANSPORT,
  flight: EActivityTag.TRANSPORT,
  train: EActivityTag.TRANSPORT,
  bus: EActivityTag.TRANSPORT,
  taxi: EActivityTag.TRANSPORT,
  walk: EActivityTag.WALK,
  walking: EActivityTag.WALK,
  прогулка: EActivityTag.WALK,
  пешком: EActivityTag.WALK,
  хайкинг: EActivityTag.WALK,
  треккинг: EActivityTag.WALK,
  hiking: EActivityTag.WALK,
  trekking: EActivityTag.WALK,
  food: EActivityTag.FOOD,
  еда: EActivityTag.FOOD,
  обед: EActivityTag.FOOD,
  завтрак: EActivityTag.FOOD,
  ужин: EActivityTag.FOOD,
  кафе: EActivityTag.FOOD,
  ресторан: EActivityTag.FOOD,
  перекус: EActivityTag.FOOD,
  restaurant: EActivityTag.FOOD,
  lunch: EActivityTag.FOOD,
  dinner: EActivityTag.FOOD,
  cafe: EActivityTag.FOOD,
  attraction: EActivityTag.ATTRACTION,
  достопримечательность: EActivityTag.ATTRACTION,
  музей: EActivityTag.ATTRACTION,
  пляж: EActivityTag.ATTRACTION,
  водопад: EActivityTag.ATTRACTION,
  природа: EActivityTag.ATTRACTION,
  парк: EActivityTag.ATTRACTION,
  nature: EActivityTag.ATTRACTION,
  sight: EActivityTag.ATTRACTION,
  sightseeing: EActivityTag.ATTRACTION,
  museum: EActivityTag.ATTRACTION,
  beach: EActivityTag.ATTRACTION,
  relax: EActivityTag.RELAX,
  отдых: EActivityTag.RELAX,
  релакс: EActivityTag.RELAX,
  сон: EActivityTag.RELAX,
  спа: EActivityTag.RELAX,
  отель: EActivityTag.RELAX,
  hotel: EActivityTag.RELAX,
  spa: EActivityTag.RELAX,
  rest: EActivityTag.RELAX,
  activity: EActivityTag.ACTIVITY,
  активность: EActivityTag.ACTIVITY,
  экскурсия: EActivityTag.ACTIVITY,
  спорт: EActivityTag.ACTIVITY,
  тур: EActivityTag.ACTIVITY,
  tour: EActivityTag.ACTIVITY,
  excursion: EActivityTag.ACTIVITY,
}

export function sanitizeActivityTag(tag: any): EActivityTag {
  if (typeof tag === 'string') {
    const lower = tag.trim().toLowerCase()
    if (VALID_TAGS.has(lower as EActivityTag)) {
      return lower as EActivityTag
    }
    if (ClientTagSynonyms[lower]) {
      return ClientTagSynonyms[lower]
    }
  }
  return EActivityTag.ACTIVITY
}

export function sanitizeTimeString(timeStr: any): string {
  if (!timeStr || typeof timeStr !== 'string') {
    return '00:00'
  }
  const trimmed = timeStr.trim()
  const match = /^(\d):([0-5]\d)$/.exec(trimmed)
  if (match) {
    return `0${match[1]}:${match[2]}`
  }
  return trimmed
}

export function sanitizeActivity<T extends Partial<IActivity>>(activity: T): T {
  const result = { ...activity }
  if (result.tag !== undefined && result.tag !== null) {
    result.tag = sanitizeActivityTag(result.tag)
  }
  if (result.startTime) {
    result.startTime = sanitizeTimeString(result.startTime)
  }
  if (result.endTime) {
    result.endTime = sanitizeTimeString(result.endTime)
  }
  return result
}
