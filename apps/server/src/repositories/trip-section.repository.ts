import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { tripSections } from '~/../db/schema'

type TripSectionInsert = typeof tripSections.$inferInsert
type TripSectionUpdate = Partial<Pick<TripSectionInsert, 'title' | 'icon' | 'content'>>

export const tripSectionRepository = {
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
