import type { SQL } from 'drizzle-orm'
import type { z } from 'zod'
import type { CreatePostInputSchema, ListPostsInputSchema, UpdatePostInputSchema } from '~/modules/post/post.schemas'
import { and, desc, eq, exists, ilike, lt, max, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { postElements, postLikes, postMedia, posts, savedPosts } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

const userRelationQuery = {
  columns: {
    id: true,
    name: true,
    avatarUrl: true,
  },
}

type DbClient = typeof db
type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]

async function _fetchPostData<T extends DbClient | DbTransaction>(txOrDb: T, id: string, currentUserId?: string) {
  const post = await txOrDb.query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      user: userRelationQuery,
      elements: { orderBy: (elements, { asc }) => [asc(elements.order)] },
      media: { orderBy: (media, { asc }) => [asc(media.order)] },
      savedBy: currentUserId ? { where: (sp, { eq }) => eq(sp.userId, currentUserId), limit: 1 } : undefined,
      likedBy: currentUserId ? { where: (pl, { eq }) => eq(pl.userId, currentUserId), limit: 1 } : undefined,
    },
  })

  if (!post)
    return null

  const { savedBy, likedBy, likesCount, savesCount, ...rest } = post
  return {
    ...rest,
    user: post.user as { id: string, name: string | null, avatarUrl: string | null },
    stats: {
      likes: likesCount,
      saves: savesCount,
      isLiked: !!likedBy?.length,
      isSaved: !!savedBy?.length,
    },
  }
}

export const postRepository = {
  async findAll(filters: z.infer<typeof ListPostsInputSchema>, currentUserId?: string) {
    return measureDbQuery('posts', 'select', async () => {
      const conditions: (SQL<unknown> | undefined)[] = [eq(posts.status, 'completed')]

      if (filters.userId) {
        conditions.push(eq(posts.userId, filters.userId))
      }
      if (filters.tag) {
        conditions.push(sql`${posts.tags} @> ${JSON.stringify([filters.tag])}::jsonb`)
      }
      if (filters.country) {
        conditions.push(eq(posts.country, filters.country))
      }
      if (filters.query) {
        const searchPattern = `%${filters.query}%`
        const searchCondition = or(
          ilike(posts.title, searchPattern),
          ilike(posts.description, searchPattern),
          ilike(posts.insight, searchPattern),
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
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
        where: and(...conditions.filter((c): c is SQL<unknown> => !!c)),
        limit: filters.limit + 1,
        orderBy: [desc(posts.createdAt)],
        with: {
          user: userRelationQuery,
          media: { limit: 1, orderBy: (media, { asc }) => [asc(media.order)] },
          // ИСПОЛЬЗУЕМ CALLBACK ДЛЯ WHERE, ЧТОБЫ ИЗБЕЖАТЬ ОШИБОК С АЛИАСАМИ ТАБЛИЦ
          savedBy: currentUserId ? { where: (sp, { eq }) => eq(sp.userId, currentUserId), limit: 1 } : undefined,
          likedBy: currentUserId ? { where: (pl, { eq }) => eq(pl.userId, currentUserId), limit: 1 } : undefined,
        },
      })

      let nextCursor: string | undefined
      if (items.length > filters.limit) {
        const nextItem = items.pop()
        nextCursor = nextItem?.id
      }

      const mappedItems = items.map((post) => {
        const { savedBy, likedBy, likesCount, savesCount, ...rest } = post
        return {
          ...rest,
          user: post.user as { id: string, name: string | null, avatarUrl: string | null },
          stats: {
            likes: likesCount,
            saves: savesCount,
            isLiked: !!likedBy?.length,
            isSaved: !!savedBy?.length,
          },
        }
      })

      return { items: mappedItems, nextCursor }
    })
  },

  async findById(id: string, currentUserId?: string) {
    return measureDbQuery('posts', 'select', async () => {
      return await _fetchPostData(db, id, currentUserId)
    })
  },

  async create(data: z.infer<typeof CreatePostInputSchema>, userId: string) {
    return measureDbQuery('posts', 'insert', async () => {
      return await db.transaction(async (tx) => {
        const lowerTags = data.tags.map(t => t.toLowerCase())
        const startDate = data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : null

        const inserted = await tx.insert(posts).values({
          id: uuidv4(),
          userId,
          title: data.title,
          insight: data.insight,
          description: data.description,
          country: data.country,
          startDate,
          tags: lowerTags,
          status: data.status,
          latitude: data.latitude,
          longitude: data.longitude,
          statsDetail: { views: 0, duration: 0, ...data.statsDetail },
        }).returning()

        const post = inserted[0]
        if (!post)
          throw new Error('Post creation failed, no returned post.')

        if (data.elements && data.elements.length > 0) {
          const elementsToInsert = data.elements.map((el, index) => ({
            id: uuidv4(),
            postId: post.id,
            order: index,
            day: el.day,
            time: el.time,
            title: el.title,
            content: el.content,
          }))
          if (elementsToInsert.length > 0) {
            await tx.insert(postElements).values(elementsToInsert)
          }
        }

        if (data.mediaIds && data.mediaIds.length > 0) {
          const updates = data.mediaIds.map((id, index) =>
            tx.update(postMedia).set({ order: index }).where(eq(postMedia.id, id)),
          )
          await Promise.all(updates)
        }

        return await _fetchPostData(tx, post.id, userId)
      })
    })
  },

  async createMedia(data: Omit<typeof postMedia.$inferInsert, 'id' | 'order'>) {
    return measureDbQuery('postMedia', 'insert', async () => {
      const maxOrderResult = await db.select({ value: max(postMedia.order) })
        .from(postMedia)
        .where(eq(postMedia.postId, data.postId))

      const nextOrder = (maxOrderResult[0].value ?? -1) + 1

      const result = await db.insert(postMedia).values({ id: uuidv4(), ...data, order: nextOrder }).returning()
      return result[0]
    })
  },

  async update(id: string, updateInput: z.infer<typeof UpdatePostInputSchema>['data']) {
    return measureDbQuery('posts', 'update', async () => {
      return await db.transaction(async (tx) => {
        const { elements, mediaIds, statsDetail, startDate, tags, ...postData } = updateInput

        if (Object.keys(postData).length > 0 || statsDetail || startDate !== undefined || tags) {
          const payload: Record<string, unknown> = { ...postData, updatedAt: new Date() }
          if (statsDetail) {
            payload.statsDetail = sql`${posts.statsDetail} || ${JSON.stringify(statsDetail)}::jsonb`
          }
          if (startDate !== undefined) {
            payload.startDate = startDate ? new Date(startDate).toISOString().split('T')[0] : null
          }
          if (tags) {
            payload.tags = tags.map(t => t.toLowerCase())
          }
          await tx.update(posts)
            .set(payload)
            .where(eq(posts.id, id))
        }

        if (elements) {
          await tx.delete(postElements).where(eq(postElements.postId, id))

          if (elements.length > 0) {
            const elementsToInsert = elements.map((el, index) => ({
              id: uuidv4(),
              postId: id,
              order: index,
              day: el.day,
              time: el.time,
              title: el.title,
              content: el.content,
            }))
            await tx.insert(postElements).values(elementsToInsert)
          }
        }

        if (mediaIds && mediaIds.length > 0) {
          const updates = mediaIds.map((id, index) =>
            tx.update(postMedia).set({ order: index }).where(eq(postMedia.id, id)),
          )
          await Promise.all(updates)
        }

        const userResult = await tx.query.posts.findFirst({ where: eq(posts.id, id), columns: { userId: true } })

        return await _fetchPostData(tx, id, userResult?.userId)
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
      await db.update(posts).set({ savesCount: sql`${posts.savesCount} - 1` }).where(eq(posts.id, postId))
      return false
    }
    else {
      await db.insert(savedPosts).values({ postId, userId })
      await db.update(posts).set({ savesCount: sql`${posts.savesCount} + 1` }).where(eq(posts.id, postId))
      return true
    }
  },

  async toggleLike(postId: string, userId: string) {
    const existing = await db.query.postLikes.findFirst({
      where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
    })
    if (existing) {
      await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      await db.update(posts).set({ likesCount: sql`${posts.likesCount} - 1` }).where(eq(posts.id, postId))
      return false
    }
    else {
      await db.insert(postLikes).values({ postId, userId })
      await db.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, postId))
      return true
    }
  },

  async incrementViewCount(id: string) {
    await db.update(posts).set({ viewsCount: sql`${posts.viewsCount} + 1` }).where(eq(posts.id, id))
  },

  async getMediaByPostId(postId: string) {
    return await db.query.postMedia.findMany({
      where: eq(postMedia.postId, postId),
    })
  },

  async getUniqueTags(query?: string) {
    return measureDbQuery('posts', 'select', async () => {
      const tagExpression = sql<string>`jsonb_array_elements_text(${posts.tags})`
      const baseQuery = db.selectDistinct({ tag: tagExpression }).from(posts).orderBy(tagExpression).limit(20)
      if (query) {
        baseQuery.where(ilike(tagExpression, `%${query}%`))
      }
      const result = await baseQuery
      return result.map(row => row.tag).filter(Boolean)
    })
  },
}
