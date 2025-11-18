import type { IActivity } from '../models/types'
import type { IImageViewerImageMeta, ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import type { TripImage } from '~/shared/types/models/trip'
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
}

export const activityTagColors: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: '#A2D2FF80',
  [EActivityTag.WALK]: '#B9FBC080',
  [EActivityTag.FOOD]: '#FFD6A580',
  [EActivityTag.ATTRACTION]: '#E0BBE480',
  [EActivityTag.RELAX]: '#A0E7E580',
}

export const activityTagLabels: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: 'Транспорт',
  [EActivityTag.WALK]: 'Прогулка',
  [EActivityTag.FOOD]: 'Еда',
  [EActivityTag.ATTRACTION]: 'Достопримечательность',
  [EActivityTag.RELAX]: 'Отдых',
}

// Расширенный тип метаданных для внутреннего использования, чтобы хранить ID для обратной связи
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
 * Преобразует объект TripImage в формат, необходимый для kit-image-viewer.
 * @param image - Объект TripImage.
 * @returns Объект ImageViewerImage.
 */
export function tripImageToViewerImage(image: TripImage): ImageViewerImage {
  const meta: CustomImageViewerImageMeta = {
    ...(image.metadata || {}),
    latitude: image.latitude,
    longitude: image.longitude,
    takenAt: image.takenAt,
    width: image.width,
    height: image.height,
    imageId: image.id,
  }

  return {
    url: image.url,
    variants: image.variants,
    alt: image.metadata?.iptc?.headline || 'Trip Image',
    caption: image.metadata?.iptc?.caption,
    meta,
  }
}

/**
 * Преобразует объект Memory (содержащий TripImage) в формат для kit-image-viewer.
 * @param memory - Объект Memory.
 * @returns Объект ImageViewerImage или null, если изображение отсутствует.
 */
export function memoryToViewerImage(memory: Memory): ImageViewerImage | null {
  if (!memory.image) {
    return null
  }
  const viewerImage = tripImageToViewerImage(memory.image)

  viewerImage.alt = memory.comment || viewerImage.alt
  viewerImage.caption = memory.comment || viewerImage.caption

  if (viewerImage.meta) {
    (viewerImage.meta as CustomImageViewerImageMeta).memoryId = memory.id
  }

  return viewerImage
}
