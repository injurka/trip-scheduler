import type { z } from 'zod'
import type { CreateCommentInputSchema } from '~/modules/comment/comment.schemas'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { comments } from '~/../db/schema'

export const commentRepository = {
  /**
   * Получает комментарии для определенного родителя (trip, day) с пагинацией.
   */
  async getByParent(parentId: string, limit: number, page: number) {
    const offset = (page - 1) * limit

    const data = await db.query.comments.findMany({
      where: eq(comments.parentId, parentId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [desc(comments.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.parentId, parentId))

    return { data, total: Number(totalResult.count) }
  },

  /**
   * Находит комментарий по ID.
   */
  async findById(id: string) {
    return await db.query.comments.findFirst({
      where: eq(comments.id, id),
    })
  },

  /**
   * Создает новый комментарий.
   */
  async create(data: z.infer<typeof CreateCommentInputSchema> & { userId: string }) {
    const [newComment] = await db
      .insert(comments)
      .values(data)
      .returning()

    // Возвращаем полный объект с данными пользователя
    return await db.query.comments.findFirst({
      where: eq(comments.id, newComment.id),
      with: {
        user: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    })
  },

  /**
   * Обновляет текст комментария.
   */
  async update(id: string, text: string) {
    const [updatedComment] = await db
      .update(comments)
      .set({ text, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning()

    return await db.query.comments.findFirst({
      where: eq(comments.id, updatedComment.id),
      with: {
        user: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    })
  },

  /**
   * Удаляет комментарий.
   */
  async delete(id: string) {
    const [deletedComment] = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning()

    return deletedComment
  },
}
