import { isRecord } from '@injurka/type-utils'
import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { tripImages, tripSections } from '~/../db/schema'
import { createTRPCError } from '~/lib/trpc'
import { parseDocumentFolders } from '~/modules/trip-section/document-folders'

type TripSectionInsert = typeof tripSections.$inferInsert
type TripSectionUpdate = Partial<Pick<TripSectionInsert, 'title' | 'icon' | 'content'>>

export const tripSectionRepository = {
  async findDocumentSections(tripId: string) {
    return db.select().from(tripSections).where(and(eq(tripSections.tripId, tripId), eq(tripSections.type, 'documents')))
  },

  async create(data: Omit<TripSectionInsert, 'id' | 'createdAt' | 'updatedAt' | 'order'>) {
    // Получаем максимальное значение `order` для данного tripId и прибавляем 1
    const maxOrderResult = await db.select({
      maxOrder: sql<number>`max("order")`,
    }).from(tripSections).where(eq(tripSections.tripId, data.tripId))
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1

    const [newSection] = await db
      .insert(tripSections)
      .values({
        ...data,
        id: uuidv4(),
        order: nextOrder,
      })
      .returning()

    return newSection
  },

  async findByIdWithOwner(id: string) {
    return await db.query.tripSections.findFirst({
      where: eq(tripSections.id, id),
      with: {
        trip: {
          columns: {
            userId: true,
          },
        },
      },
    })
  },

  async updateDocumentSection(id: string, tripId: string, data: TripSectionUpdate, expectedUpdatedAt: Date) {
    return db.transaction(async (tx) => {
      const sections = await tx.select().from(tripSections).where(and(eq(tripSections.tripId, tripId), eq(tripSections.type, 'documents'))).orderBy(tripSections.id).for('update')
      const current = sections.find(s => s.id === id)
      if (!current || current.updatedAt.getTime() !== expectedUpdatedAt.getTime())
        throw createTRPCError('CONFLICT', 'Структура документов изменилась. Обновите страницу.')
      if (data.content !== undefined) {
        const content = parseDocumentFolders(data.content, current.content)
        const ids = new Set(content.folders.map(f => f.id))
        const removed = new Set(parseDocumentFolders(current.content).folders.filter(f => !ids.has(f.id)).map(f => f.id))
        const files = await tx.select({ metadata: tripImages.metadata }).from(tripImages).where(and(eq(tripImages.tripId, tripId), eq(tripImages.placement, 'documents')))
        for (const file of files) {
          const meta = isRecord(file.metadata) ? file.metadata : {}
          const folderId = typeof meta.folderId === 'string' ? meta.folderId : isRecord(meta.metadata) ? meta.metadata.folderId : null
          if (typeof folderId === 'string' && removed.has(folderId))
            throw createTRPCError('CONFLICT', 'В папке появились документы. Обновите список перед удалением.')
        }
        data = { ...data, content }
      }
      const [updated] = await tx.update(tripSections).set({ ...data, updatedAt: new Date() }).where(eq(tripSections.id, id)).returning()
      return updated
    })
  },

  async update(id: string, data: TripSectionUpdate) {
    const [updatedSection] = await db
      .update(tripSections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tripSections.id, id))
      .returning()

    return updatedSection || null
  },

  async delete(id: string) {
    const [deletedSection] = await db
      .delete(tripSections)
      .where(eq(tripSections.id, id))
      .returning()

    return deletedSection || null
  },

  async reorder(tripId: string, updates: { id: string, order: number }[]) {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(tripSections)
          .set({ order: update.order })
          .where(and(eq(tripSections.id, update.id), eq(tripSections.tripId, tripId)))
      }
    })
  },
}
