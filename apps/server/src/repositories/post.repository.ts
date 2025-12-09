import type { z } from 'zod'
import type { CreatePostInputSchema, ListPostsInputSchema, UpdatePostInputSchema } from '~/modules/post/post.schemas'
import { and, desc, eq, exists, ilike, lt, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { postElements, postMedia, posts, savedPosts } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

const userRelationQuery = {
  columns: {
    id: true,
    name: true,
    avatarUrl: true,
  },
}

export const postRepository = {
  async findAll(filters: z.infer<typeof ListPostsInputSchema>, currentUserId?: string) {
    return measureDbQuery('posts', 'select', async () => {
      const conditions = []

      if (!filters.userId || filters.userId !== currentUserId) {
        conditions.push(eq(posts.status, 'completed'))
      }
      if (filters.userId) {
        conditions.push(eq(posts.userId, filters.userId))
      }
      if (filters.tag) {
        conditions.push(sql`${posts.tags} ? ${filters.tag}`)
      }
      if (filters.country) {
        conditions.push(eq(posts.country, filters.country))
      }
      if (filters.query) {
        const searchPattern = `%${filters.query}%`
        conditions.push(or(
          ilike(posts.title, searchPattern),
          ilike(posts.description, searchPattern),
          ilike(posts.insight, searchPattern),
        ))
      }
      if (filters.onlySaved && currentUserId) {
        conditions.push(exists(
          db.select().from(savedPosts).where(and(eq(savedPosts.postId, posts.id), eq(savedPosts.userId, currentUserId))),
        ))
      }
      if (filters.cursor) {
        const cursorPost = await db.query.posts.findFirst({
          where: eq(posts.id, filters.cursor),
          columns: { createdAt: true },
        })
        if (cursorPost) {
          conditions.push(lt(posts.createdAt, cursorPost.createdAt))
        }
      }

      const items = await db.query.posts.findMany({
        where: and(...conditions),
        limit: filters.limit + 1,
        orderBy: [desc(posts.createdAt)],
        with: {
          user: userRelationQuery,
          media: { limit: 1 },
          savedBy: currentUserId ? { where: eq(savedPosts.userId, currentUserId), limit: 1 } : undefined,
        },
      })

      let nextCursor: string | undefined
      if (items.length > filters.limit) {
        const nextItem = items.pop()
        nextCursor = nextItem?.id
      }

      const mappedItems = items.map((post) => {
        const { savedBy, ...rest } = post
        return {
          ...rest,
          user: post.user as { id: string, name: string | null, avatarUrl: string | null },
          isSaved: savedBy ? savedBy.length > 0 : false,
        }
      })

      return { items: mappedItems, nextCursor }
    })
  },

  async findById(id: string, currentUserId?: string) {
    return measureDbQuery('posts', 'select', async () => {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, id),
        with: {
          user: userRelationQuery,
          elements: { orderBy: (elements, { asc }) => [asc(elements.order)] },
          media: true,
          savedBy: currentUserId ? { where: eq(savedPosts.userId, currentUserId), limit: 1 } : undefined,
        },
      })

      if (!post)
        return null

      const { savedBy, ...rest } = post
      return {
        ...rest,
        user: post.user as { id: string, name: string | null, avatarUrl: string | null },
        isSaved: savedBy ? savedBy.length > 0 : false,
      }
    })
  },

  async create(data: z.infer<typeof CreatePostInputSchema>, userId: string) {
    return measureDbQuery('posts', 'insert', async () => {
      return await db.transaction(async (tx) => {
        const postId = uuidv4()

        await tx.insert(posts).values({
          id: postId,
          userId,
          title: data.title,
          insight: data.insight,
          description: data.description,
          country: data.country,
          tags: data.tags,
          status: data.status,
        })

        if (data.elements && data.elements.length > 0) {
          const elementsToInsert = data.elements.map((el, index) => ({
            id: uuidv4(),
            postId,
            order: index,
            title: el.title,
            content: el.content,
          }))
          await tx.insert(postElements).values(elementsToInsert)
        }

        const createdPost = await tx.query.posts.findFirst({
          where: eq(posts.id, postId),
          with: {
            user: userRelationQuery,
            elements: { orderBy: (el, { asc }) => [asc(el.order)] },
            media: true,
          },
        })

        if (!createdPost)
          throw new Error('Post created but could not be retrieved')

        return {
          ...createdPost,
          user: createdPost.user as { id: string, name: string | null, avatarUrl: string | null },
          isSaved: false,
        }
      })
    })
  },

  /**
   * Добавление медиа-файла.
   */
  async createMedia(data: typeof postMedia.$inferInsert) {
    return measureDbQuery('postMedia', 'insert', async () => {
      const [newMedia] = await db.insert(postMedia).values(data).returning()
      return newMedia
    })
  },

  /**
   * Обновление поста с заменой элементов.
   */
  async update(id: string, updateInput: z.infer<typeof UpdatePostInputSchema>['data']) {
    return measureDbQuery('posts', 'update', async () => {
      return await db.transaction(async (tx) => {
        const { elements, ...postData } = updateInput

        if (Object.keys(postData).length > 0) {
          await tx.update(posts)
            .set({ ...postData, updatedAt: new Date() })
            .where(eq(posts.id, id))
        }

        if (elements) {
          // Удаляем старые элементы
          await tx.delete(postElements).where(eq(postElements.postId, id))

          // Добавляем новые
          if (elements.length > 0) {
            const elementsToInsert = elements.map((el, index) => ({
              id: uuidv4(),
              postId: id,
              order: index,
              title: el.title,
              content: el.content,
            }))
            await tx.insert(postElements).values(elementsToInsert)
          }
        }

        const updatedPost = await tx.query.posts.findFirst({
          where: eq(posts.id, id),
          with: {
            user: userRelationQuery,
            elements: { orderBy: (el, { asc }) => [asc(el.order)] },
            media: true,
          },
        })

        if (!updatedPost)
          return null

        return {
          ...updatedPost,
          user: updatedPost.user as { id: string, name: string | null, avatarUrl: string | null },
          isSaved: false,
        }
      })
    })
  },

  async delete(id: string) {
    return measureDbQuery('posts', 'delete', async () => {
      const [deleted] = await db.delete(posts).where(eq(posts.id, id)).returning()
      return deleted
    })
  },

  async toggleSave(postId: string, userId: string) {
    const existing = await db.query.savedPosts.findFirst({
      where: and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId)),
    })
    if (existing) {
      await db.delete(savedPosts).where(and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId)))
      return false
    }
    else {
      await db.insert(savedPosts).values({ postId, userId })
      return true
    }
  },

  async incrementViewCount(id: string) {
    await db.update(posts).set({ viewsCount: sql`${posts.viewsCount} + 1` }).where(eq(posts.id, id))
  },
}
