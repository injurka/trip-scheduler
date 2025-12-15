import type { tripImagePlacementEnum } from '../../db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { tripImages, trips } from '../../db/schema'

type Placement = (typeof tripImagePlacementEnum.enumValues)[number]

/**
 * Определяет структуру метаданных, извлекаемых из изображения.
 */
export interface ImageMetadata {
  takenAt: Date | null
  latitude: number | null
  longitude: number | null
  width: number | null
  height: number | null
  variants: Record<string, string> | null
  metadata: {
    orientation?: number
    timezoneOffset?: number
    cameraMake?: string
    cameraModel?: string
    fNumber?: number
    exposureTime?: number
    iso?: number
    focalLength?: number
    apertureValue?: number
    [key: string]: unknown
  } | null
}

/**
 * Колонки для оптимизированной выдачи (например, для маршрута).
 * Исключены тяжелые поля: metadata, variants, геоданные.
 * Исключены избыточные поля: tripId, placement (они известны из контекста запроса).
 */
const ROUTE_COLUMNS = {
  id: true,
  url: true,
  originalName: true,
  createdAt: true,
  sizeBytes: true,
  width: true,
  height: true,
} as const

/**
 * Полный набор колонок для детального просмотра или галереи.
 */
const FULL_COLUMNS = {
  id: true,
  tripId: true,
  url: true,
  originalName: true,
  placement: true,
  createdAt: true,
  sizeBytes: true,
  takenAt: true,
  latitude: true,
  longitude: true,
  width: true,
  height: true,
  variants: true,
  metadata: true,
} as const

export const imageRepository = {
  async create(
    tripId: string,
    url: string,
    originalName: string,
    placement: Placement,
    sizeBytes: number,
    metadata: ImageMetadata,
  ) {
    const [newImage] = await db
      .insert(tripImages)
      .values({
        tripId,
        url,
        originalName,
        placement,
        sizeBytes,
        takenAt: metadata.takenAt,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        width: metadata.width,
        height: metadata.height,
        variants: metadata.variants,
        metadata: metadata.metadata,
      })
      .returning()

    return newImage
  },

  /**
   * Получает метаданные конкретного изображения.
   */
  async getMetadata(id: string) {
    const image = await db.query.tripImages.findFirst({
      where: eq(tripImages.id, id),
      columns: {
        metadata: true,
      },
    })
    return image?.metadata || null
  },

  /**
   * Получает все изображения для конкретного путешествия.
   * Если placement === 'route', возвращает облегченный набор данных.
   */
  async getByTripId(tripId: string, placement?: Placement) {
    const conditions = [eq(tripImages.tripId, tripId)]
    if (placement) {
      conditions.push(eq(tripImages.placement, placement))
    }

    // Выбираем набор колонок в зависимости от типа размещения
    const columnsToSelect = placement === 'route' ? ROUTE_COLUMNS : FULL_COLUMNS

    const result = await db.query.tripImages.findMany({
      where: and(...conditions),
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      columns: columnsToSelect,
    })

    return result
  },

  /**
   * Получает все изображения для конкретного пользователя.
   */
  async getAllByUserId(userId: string) {
    const userTrips = await db.select({ id: trips.id }).from(trips).where(eq(trips.userId, userId))
    if (userTrips.length === 0) {
      return []
    }
    const tripIds = userTrips.map(t => t.id)

    return await db.query.tripImages.findMany({
      where: inArray(tripImages.tripId, tripIds),
      with: {
        trip: {
          columns: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      columns: FULL_COLUMNS,
    })
  },

  /**
   * Получает одно изображение по ID.
   * Возвращает полный объект (используется при удалении и т.д.).
   */
  async getById(id: string) {
    return await db.query.tripImages.findFirst({
      where: eq(tripImages.id, id),
      with: {
        trip: {
          columns: {
            userId: true,
          },
        },
      },
    })
  },

  async delete(id: string) {
    const [deletedImage] = await db
      .delete(tripImages)
      .where(eq(tripImages.id, id))
      .returning()

    return deletedImage || null
  },
}
