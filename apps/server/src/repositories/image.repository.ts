import type { tripImagePlacementEnum } from '../../db/schema'
import type { DocumentMetadata, TripDocument } from '~/models/image'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'

import { highlights, tripImages, trips } from '../../db/schema'

type Placement = (typeof tripImagePlacementEnum.enumValues)[number]

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

const DOCUMENT_COLUMNS = {
  id: true,
  tripId: true,
  url: true,
  originalName: true,
  sizeBytes: true,
  createdAt: true,
  metadata: true,
} as const

const ROUTE_COLUMNS = {
  id: true,
  url: true,
  originalName: true,
  createdAt: true,
  sizeBytes: true,
  width: true,
  height: true,
} as const

const FULL_COLUMNS = {
  id: true,
  tripId: true,
  url: true,
  originalName: true,
  mediaType: true,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDocumentMetadata(raw: unknown): DocumentMetadata {
  if (!isRecord(raw)) {
    return {
      access: 'private',
      folderId: null,
      title: null,
      category: null,
      isFavorite: false,
      note: null,
    }
  }

  return {
    access: raw.access === 'public' ? 'public' : 'private',
    folderId: typeof raw.folderId === 'string' ? raw.folderId || null : null,
    title: typeof raw.title === 'string' ? raw.title || null : null,
    category: typeof raw.category === 'string' ? raw.category || null : null,
    isFavorite: Boolean(raw.isFavorite),
    note: typeof raw.note === 'string' ? raw.note || null : null,
  }
}

function toTripDocument(doc: {
  id: string
  tripId: string
  url: string
  originalName: string
  sizeBytes: number
  createdAt: Date
  metadata: unknown
}): TripDocument {
  return {
    id: doc.id,
    tripId: doc.tripId,
    url: doc.url,
    originalName: doc.originalName,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt,
    metadata: parseDocumentMetadata(doc.metadata),
  }
}

export const imageRepository = {
  async create(
    tripId: string,
    url: string,
    originalName: string,
    placement: Placement,
    sizeBytes: number,
    metadata: ImageMetadata,
    mediaType?: 'image' | 'video',
  ) {
    const [newImage] = await db
      .insert(tripImages)
      .values({
        tripId,
        url,
        originalName,
        mediaType: mediaType || 'image',
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

  async getMetadata(id: string) {
    // 1. Сначала ищем среди обычных фото
    const image = await db.query.tripImages.findFirst({
      where: eq(tripImages.id, id),
      columns: {
        metadata: true,
      },
    })
    if (image?.metadata)
      return image.metadata

    // 2. Если не нашли, значит это может быть фото из витрины пользователя
    const highlight = await db.query.highlights.findFirst({
      where: eq(highlights.id, id),
      columns: {
        metadata: true,
      },
    })

    return highlight?.metadata || null
  },

  async getByTripId(tripId: string, placement?: Placement) {
    const conditions = [eq(tripImages.tripId, tripId)]
    if (placement) {
      conditions.push(eq(tripImages.placement, placement))
    }

    const columnsToSelect = placement === 'route' ? ROUTE_COLUMNS : FULL_COLUMNS

    const result = await db.query.tripImages.findMany({
      where: and(...conditions),
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      columns: columnsToSelect,
    })

    return result
  },

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
      columns: {
        id: true,
        tripId: true,
        url: true,
        originalName: true,
        mediaType: true,
        placement: true,
        createdAt: true,
        sizeBytes: true,
        variants: true,
        width: true,
        height: true,
      },
    })
  },

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

  async listDocuments(tripId: string): Promise<TripDocument[]> {
    const docs = await db.query.tripImages.findMany({
      where: and(eq(tripImages.tripId, tripId), eq(tripImages.placement, 'documents')),
      columns: DOCUMENT_COLUMNS,
      orderBy: (images, { desc }) => [desc(images.createdAt)],
    })

    return docs.map(toTripDocument)
  },

  async updateDocumentMeta(id: string, newMetadata: Partial<DocumentMetadata>): Promise<TripDocument | null> {
    const current = await this.getById(id)
    if (!current)
      return null

    const currentMetadata = isRecord(current.metadata) ? current.metadata : {}
    const mergedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      ...newMetadata,
    }

    const [updated] = await db.update(tripImages)
      .set({ metadata: mergedMetadata })
      .where(eq(tripImages.id, id))
      .returning()

    if (!updated)
      return null

    return toTripDocument(updated)
  },
}
