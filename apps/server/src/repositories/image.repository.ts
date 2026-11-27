import type { tripImagePlacementEnum } from '../../db/schema'
import type { DocumentMetadata, TripDocument } from '~/models/image'
import { and, eq, inArray } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { createTRPCError } from '~/lib/trpc'

import { parseDocumentFolders } from '~/modules/trip-section/document-folders'
import { db } from '../../db'
import { highlights, tripImages, trips, tripSections } from '../../db/schema'

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
    thumbhash?: string
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
  mediaType: true,
  createdAt: true,
  sizeBytes: true,
  width: true,
  height: true,
  variants: true,
  metadata: true,
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

  const metaObj = (isRecord(raw.metadata) && typeof raw.folderId !== 'string')
    ? { ...raw, ...raw.metadata }
    : raw

  return {
    access: metaObj.access === 'public' ? 'public' : 'private',
    folderId: typeof metaObj.folderId === 'string' ? metaObj.folderId || null : null,
    title: typeof metaObj.title === 'string' ? metaObj.title || null : null,
    category: typeof metaObj.category === 'string' ? metaObj.category || null : null,
    isFavorite: Boolean(metaObj.isFavorite),
    note: typeof metaObj.note === 'string' ? metaObj.note || null : null,
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
    const values = {
      tripId,
      url,
      originalName,
      mediaType: mediaType || 'image' as const,
      placement,
      sizeBytes,
      takenAt: metadata.takenAt,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      width: metadata.width,
      height: metadata.height,
      variants: metadata.variants,
      metadata: metadata.metadata,
    }
    if (placement === 'documents') {
      return db.transaction(async (tx) => {
        const sections = await tx.select().from(tripSections).where(and(eq(tripSections.tripId, tripId), eq(tripSections.type, 'documents'))).orderBy(tripSections.id).for('update')
        const folderId = parseDocumentMetadata(metadata.metadata).folderId
        if (folderId && !sections.some(section => parseDocumentFolders(section.content).folders.some(f => f.id === folderId)))
          throw createTRPCError('BAD_REQUEST', 'Папка загрузки не найдена в этом путешествии.')
        const [created] = await tx.insert(tripImages).values(values).returning()
        return created
      })
    }
    const [newImage] = await db.insert(tripImages).values(values).returning()
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

    const result = await measureDbQuery('tripImages', 'select', () => db.query.tripImages.findMany({
      where: and(...conditions),
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      columns: columnsToSelect,
    }))

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

    return db.transaction(async (tx) => {
      const sections = await tx.select().from(tripSections).where(and(eq(tripSections.tripId, current.tripId), eq(tripSections.type, 'documents'))).orderBy(tripSections.id).for('update')
      if (newMetadata.folderId && !sections.some(section => parseDocumentFolders(section.content).folders.some(f => f.id === newMetadata.folderId)))
        throw createTRPCError('BAD_REQUEST', 'Папка больше не существует в этом путешествии.')
      const [fresh] = await tx.select().from(tripImages).where(eq(tripImages.id, id)).for('update')
      if (!fresh)
        return null
      const mergedMetadata = { ...(isRecord(fresh.metadata) ? fresh.metadata : {}), ...newMetadata }
      const [updated] = await tx.update(tripImages).set({ metadata: mergedMetadata }).where(eq(tripImages.id, id)).returning()
      return updated ? toTripDocument(updated) : null
    })
  },
}
