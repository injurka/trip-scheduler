import { and, asc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { tripImages, tripNoteImages, tripNotes } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const noteRepository = {
  async getByTripId(tripId: string) {
    return measureDbQuery('tripNotes', 'select', async () => {
      return await db.query.tripNotes.findMany({
        where: eq(tripNotes.tripId, tripId),
        orderBy: [asc(tripNotes.order), asc(tripNotes.createdAt)],
        with: {
          noteImages: {
            with: {
              image: {
                columns: { id: true, url: true, variants: true },
              },
            },
          },
        },
      })
    })
  },

  async getById(id: string) {
    return measureDbQuery('tripNotes', 'select', async () => {
      return await db.query.tripNotes.findFirst({
        where: eq(tripNotes.id, id),
        with: {
          trip: { columns: { userId: true } },
          noteImages: {
            with: {
              image: {
                columns: { id: true, url: true, variants: true },
              },
            },
          },
        },
      })
    })
  },

  async create(data: { tripId: string, parentId?: string | null, type: 'folder' | 'markdown' | 'excalidraw', title: string, order?: number, color?: string | null }) {
    return measureDbQuery('tripNotes', 'insert', async () => {
      const [note] = await db.insert(tripNotes).values({
        id: uuidv4(),
        tripId: data.tripId,
        parentId: data.parentId ?? null,
        type: data.type,
        title: data.title,
        order: data.order ?? 0,
        color: data.color ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()
      return note
    })
  },

  async update(id: string, data: { title?: string, content?: string | null, parentId?: string | null, order?: number, color?: string | null, imageIds?: string[] }) {
    return measureDbQuery('tripNotes', 'update', async () => {
      return await db.transaction(async (tx) => {
        const { imageIds, ...updateData } = data

        let updatedNote = null
        if (Object.keys(updateData).length > 0) {
          const [res] = await tx.update(tripNotes).set({
            ...updateData,
            updatedAt: new Date(),
          }).where(eq(tripNotes.id, id)).returning()
          updatedNote = res
        }

        if (imageIds !== undefined) {
          await tx.delete(tripNoteImages).where(eq(tripNoteImages.noteId, id))
          if (imageIds.length > 0) {
            await tx.insert(tripNoteImages).values(
              imageIds.map(imageId => ({ noteId: id, imageId })),
            )
          }
        }

        return updatedNote
      })
    })
  },

  async delete(id: string) {
    return measureDbQuery('tripNotes', 'delete', async () => {
      const [deleted] = await db.delete(tripNotes).where(eq(tripNotes.id, id)).returning()
      return deleted
    })
  },

  async reorder(tripId: string, updates: { id: string, parentId: string | null, order: number }[]) {
    return measureDbQuery('tripNotes', 'update', async () => {
      await db.transaction(async (tx) => {
        for (const update of updates) {
          await tx.update(tripNotes).set({
            parentId: update.parentId,
            order: update.order,
          }).where(and(
            eq(tripNotes.id, update.id),
            eq(tripNotes.tripId, tripId),
          ))
        }
      })
    })
  },

  async checkCycle(noteId: string, newParentId: string | null): Promise<boolean> {
    if (!newParentId)
      return false
    if (noteId === newParentId)
      return true

    const query = sql`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "parent_id"
        FROM ${tripNotes}
        WHERE "id" = ${newParentId}
        UNION
        SELECT tn."id", tn."parent_id"
        FROM ${tripNotes} tn
        JOIN ancestors a ON tn."id" = a."parent_id"
      )
      SELECT 1 FROM ancestors WHERE "id" = ${noteId};
    `
    const result = await db.execute(query)
    return result.rows.length > 0
  },

  async getImagesUsage(tripId: string) {
    return measureDbQuery('tripImages', 'select', async () => {
      return await db.query.tripImages.findMany({
        where: and(
          eq(tripImages.tripId, tripId),
          eq(tripImages.placement, 'notes'),
        ),
        columns: {
          id: true,
          url: true,
          variants: true,
          width: true,
          height: true,
        },
        with: {
          noteImages: {
            with: {
              note: {
                columns: {
                  id: true,
                  title: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: [asc(tripImages.createdAt)],
      })
    })
  },
}
