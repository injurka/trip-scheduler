import type { Comment, CommentRecord } from './comment.types'
import { v4 as uuidv4 } from 'uuid'
import { db, toId } from '~/db'

export const commentRepository = {
  async getByParent(parentId: string, limit: number, page: number) {
    const offset = (page - 1) * limit

    const [comments, countRes] = await db.query<[Comment[], [{ count: number }]]>(`
        -- Первый запрос для получения комментариев
        SELECT *, user.name, user.avatarUrl 
        FROM comment 
        WHERE parentId = $pid 
        ORDER BY createdAt DESC 
        LIMIT $limit START $offset
        FETCH user;

        -- Второй запрос для получения общего количества
        SELECT count() FROM comment WHERE parentId = $pid GROUP ALL;
    `, { pid: parentId, limit, offset })

    return {
      data: comments || [],
      total: countRes?.[0]?.count || 0,
    }
  },

  async findById(id: string): Promise<CommentRecord | null> {
    const recordId = toId('comment', id)

    try {
      const [comment] = await db.select<CommentRecord>(recordId)
      return comment || null
    }
    catch {
      return null
    }
  },

  async create(data: { text: string, userId: string, parentId: string, parentType: string }) {
    const id = uuidv4()
    const recordId = toId('comment', id)
    const userRecordId = toId('user', data.userId)

    const [newComments] = await db.query<[Comment[]]>(`
      CREATE $id CONTENT {
        text: $text,
        user: $user,
        parentId: $parentId,
        parentType: $parentType,
        createdAt: time::now(),
        updatedAt: time::now()
      } RETURN AFTER FETCH user
    `, {
      id: recordId,
      text: data.text,
      user: userRecordId,
      parentId: data.parentId,
      parentType: data.parentType,
    })

    return newComments?.[0]
  },

  async update(id: string, text: string) {
    const recordId = toId('comment', id)

    const [updatedComments] = await db.query<[Comment[]]>(`
      UPDATE $id MERGE {
        text: $text,
        updatedAt: time::now()
      } RETURN AFTER FETCH user
    `, { id: recordId, text })

    return updatedComments?.[0]
  },

  async delete(id: string) {
    const recordId = toId('comment', id)
    await db.delete(recordId)
    return { id }
  },
}
