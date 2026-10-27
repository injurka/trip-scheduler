import type { SQL } from 'drizzle-orm'
import type { z } from 'zod'
import type { CreatePostInputSchema, ListPostsInputSchema, UpdatePostInputSchema } from '~/modules/post/post.schemas'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, exists, ilike, lt, max, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { postElements, postLikes, postMedia, posts, postWhitelist, savedPosts, storageCleanupTasks, users } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'
import { postMediaStorageKeys } from '~/services/storage-cleanup.service'

const userRelationQuery = {
  columns: {
    id: true,
    name: true,
    avatarUrl: true,
  },
}

const whitelistUserRelationQuery = {
  columns: {
    id: true,
    name: true,
    avatarUrl: true,
    email: true,
  },
}

type DbClient = typeof db
type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]

async function _fetchPostData<T extends DbClient | DbTransaction>(
  txOrDb: T,
  id: string,
  currentUserId?: string,
  userRole?: string,
) {
  const post = await txOrDb.query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      user: userRelationQuery,
      elements: { orderBy: (elements, { asc }) => [asc(elements.order)] },
      media: { orderBy: (media, { asc }) => [asc(media.order)] },
      whitelist: {
        with: {
          user: whitelistUserRelationQuery,
        },
      },
      savedBy: currentUserId ? { where: (sp, { eq }) => eq(sp.userId, currentUserId), limit: 1 } : undefined,
      likedBy: currentUserId ? { where: (pl, { eq }) => eq(pl.userId, currentUserId), limit: 1 } : undefined,
    },
  })

  if (!post)
    return null

  const isOwner = !!currentUserId && post.userId === currentUserId
  const isAdmin = userRole === 'admin'
  const isWhitelisted = !!currentUserId && post.whitelist.some(w => w.userId === currentUserId)
  const hasFullAccess = isOwner || isAdmin || isWhitelisted

  const { savedBy, likedBy, likesCount, savesCount, whitelist, media, ...rest } = post

  const mappedMedia = media.map((m) => {
    if (m.isPrivate && !hasFullAccess) {
      return {
        ...m,
        url: '',
        variants: null,
        metadata: null,
        hasAccess: false,
      }
    }
    return {
      ...m,
      hasAccess: true,
    }
  })

  const mappedWhitelist = whitelist.map(w => w.user as { id: string, name: string | null, avatarUrl: string | null, email: string | null })
  const whitelistUserIds = whitelist.map(w => w.userId)

  return {
    ...rest,
    media: mappedMedia,
    whitelist: isOwner || isAdmin ? mappedWhitelist : undefined,
    whitelistUserIds: isOwner || isAdmin ? whitelistUserIds : undefined,
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
  async findAll(filters: z.infer<typeof ListPostsInputSchema>, currentUserId?: string, userRole?: string) {
    return measureDbQuery('posts', 'select', async () => {
      if (filters.onlyDrafts && !currentUserId)
        return { items: [], nextCursor: undefined }
      const conditions: (SQL<unknown> | undefined)[] = [eq(posts.status, filters.onlyDrafts ? 'draft' : 'completed')]
      if (filters.onlyDrafts && currentUserId)
        conditions.push(eq(posts.userId, currentUserId))

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
          whitelist: currentUserId ? { where: (pw, { eq }) => eq(pw.userId, currentUserId), limit: 1 } : undefined,
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
        const { savedBy, likedBy, likesCount, savesCount, whitelist, media, ...rest } = post
        const isOwner = !!currentUserId && post.userId === currentUserId
        const isAdmin = userRole === 'admin'
        const isWhitelisted = !!currentUserId && !!whitelist?.length
        const hasFullAccess = isOwner || isAdmin || isWhitelisted

        const mappedMedia = media.map((m) => {
          if (m.isPrivate && !hasFullAccess) {
            return {
              ...m,
              url: '',
              variants: null,
              metadata: null,
              hasAccess: false,
            }
          }
          return {
            ...m,
            hasAccess: true,
          }
        })

        return {
          ...rest,
          media: mappedMedia,
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

  async findById(id: string, currentUserId?: string, userRole?: string) {
    return measureDbQuery('posts', 'select', async () => {
      return await _fetchPostData(db, id, currentUserId, userRole)
    })
  },

  async create(data: z.infer<typeof CreatePostInputSchema>, userId: string) {
    return measureDbQuery('posts', 'insert', async () => {
      return await db.transaction(async (tx) => {
        const lowerTags = data.tags.map(t => t.toLowerCase())

        const startDate = data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : undefined

        const inserted = await tx.insert(posts).values({
          id: uuidv4(),
          userId,
          title: data.title,
          insight: data.insight ?? undefined,
          description: data.description ?? undefined,
          country: data.country ?? undefined,
          startDate,
          tags: lowerTags,
          status: data.status,
          latitude: data.latitude ?? undefined,
          longitude: data.longitude ?? undefined,
          statsDetail: { views: 0, duration: 0, ...(data.statsDetail || {}) },
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
            tx.update(postMedia).set({ order: index }).where(and(eq(postMedia.id, id), eq(postMedia.postId, post.id))),
          )
          await Promise.all(updates)
        }

        if (data.mediaPrivacy) {
          for (const [mid, isPrivate] of Object.entries(data.mediaPrivacy)) {
            await tx.update(postMedia).set({ isPrivate }).where(and(eq(postMedia.id, mid), eq(postMedia.postId, post.id)))
          }
        }

        if (data.whitelistUserIds && data.whitelistUserIds.length > 0) {
          const whitelistToInsert = data.whitelistUserIds.map(uid => ({
            postId: post.id,
            userId: uid,
          }))
          await tx.insert(postWhitelist).values(whitelistToInsert)
        }

        return await _fetchPostData(tx, post.id, userId)
      })
    })
  },

  async createMedia(data: Omit<typeof postMedia.$inferInsert, 'id' | 'order'>) {
    return measureDbQuery('postMedia', 'insert', async () => {
      return db.transaction(async (tx) => {
        const [post] = await tx.select({ id: posts.id, userId: posts.userId }).from(posts).where(eq(posts.id, data.postId)).for('update')
        if (!post)
          throw new Error('Пост удалён. Загрузка не может быть привязана.')
        const maxOrderResult = await tx.select({ value: max(postMedia.order) }).from(postMedia).where(eq(postMedia.postId, data.postId))
        const nextOrder = (maxOrderResult[0].value ?? -1) + 1
        const [result] = await tx.insert(postMedia).values({ id: uuidv4(), ...data, order: nextOrder }).returning()
        await tx.update(users).set({ currentStorageBytes: sql`${users.currentStorageBytes} + ${data.sizeBytes || 0}` }).where(eq(users.id, post.userId))
        return result
      })
    })
  },

  async getMediaById(id: string) {
    return measureDbQuery('postMedia', 'select', async () => {
      return await db.query.postMedia.findFirst({
        where: eq(postMedia.id, id),
        with: { post: true },
      })
    })
  },

  async deleteMedia(id: string) {
    return measureDbQuery('postMedia', 'delete', async () => {
      await db.transaction(async (tx) => {
        const media = await tx.query.postMedia.findFirst({ where: eq(postMedia.id, id) })
        if (!media)
          return
        const [post] = await tx.select().from(posts).where(eq(posts.id, media.postId)).for('update')
        if (!post)
          return
        const [removed] = await tx.delete(postMedia).where(eq(postMedia.id, id)).returning()
        if (!removed)
          return
        await tx.insert(storageCleanupTasks).values({ keys: postMediaStorageKeys(removed) })
        await tx.update(users).set({ currentStorageBytes: sql`GREATEST(0, ${users.currentStorageBytes} - ${removed.sizeBytes})` }).where(eq(users.id, post.userId))
        const elements = await tx.query.postElements.findMany({ where: eq(postElements.postId, media.postId) })
        for (const element of elements) {
          const content = element.content.filter(block => block.type !== 'image' || block.imageId !== id)
            .map(block => block.type === 'gallery' ? { ...block, imageIds: block.imageIds.filter(mid => mid !== id) } : block)
          await tx.update(postElements).set({ content }).where(eq(postElements.id, element.id))
        }
      })
    })
  },

  async update(id: string, updateInput: z.infer<typeof UpdatePostInputSchema>['data']) {
    return measureDbQuery('posts', 'update', async () => {
      return await db.transaction(async (tx) => {
        await tx.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).for('update')
        const { elements, mediaIds, mediaPrivacy, whitelistUserIds, statsDetail, startDate, tags, ...postData } = updateInput

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
          const media = await tx.select({ id: postMedia.id }).from(postMedia).where(eq(postMedia.postId, id))
          const validIds = new Set(media.map(item => item.id))
          for (const element of elements) {
            for (const block of element.content) {
              const ids = block.type === 'gallery' ? block.imageIds : block.type === 'image' ? [block.imageId] : []
              if (ids.some(mediaId => !validIds.has(mediaId)))
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'В таймлайне есть удалённое или чужое медиа. Обновите медиатеку.' })
            }
          }
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

        if (mediaIds !== undefined) {
          // Media removal is explicit (deleteMedia), never inferred from a stale draft.
          if (mediaIds.length > 0) {
            const updates = mediaIds.map((mid, index) =>
              tx.update(postMedia).set({ order: index }).where(and(eq(postMedia.id, mid), eq(postMedia.postId, id))),
            )
            await Promise.all(updates)
          }
        }

        if (mediaPrivacy !== undefined) {
          for (const [mid, isPrivate] of Object.entries(mediaPrivacy)) {
            await tx.update(postMedia).set({ isPrivate }).where(and(eq(postMedia.id, mid), eq(postMedia.postId, id)))
          }
        }

        if (whitelistUserIds !== undefined) {
          await tx.delete(postWhitelist).where(eq(postWhitelist.postId, id))
          if (whitelistUserIds.length > 0) {
            const whitelistToInsert = whitelistUserIds.map(uid => ({
              postId: id,
              userId: uid,
            }))
            await tx.insert(postWhitelist).values(whitelistToInsert)
          }
        }

        const userResult = await tx.query.posts.findFirst({ where: eq(posts.id, id), columns: { userId: true } })

        return await _fetchPostData(tx, id, userResult?.userId)
      })
    })
  },

  async updateMediaPrivacy(mediaId: string, isPrivate: boolean) {
    return measureDbQuery('postMedia', 'update', async () => {
      const [updated] = await db.update(postMedia)
        .set({ isPrivate })
        .where(eq(postMedia.id, mediaId))
        .returning()
      return updated
    })
  },

  async addWhitelistUser(postId: string, userId: string) {
    return measureDbQuery('postWhitelist', 'insert', async () => {
      await db.insert(postWhitelist)
        .values({ postId, userId })
        .onConflictDoNothing()
      return { success: true }
    })
  },

  async removeWhitelistUser(postId: string, userId: string) {
    return measureDbQuery('postWhitelist', 'delete', async () => {
      await db.delete(postWhitelist)
        .where(and(eq(postWhitelist.postId, postId), eq(postWhitelist.userId, userId)))
      return { success: true }
    })
  },

  async getWhitelist(postId: string) {
    return measureDbQuery('postWhitelist', 'select', async () => {
      const items = await db.query.postWhitelist.findMany({
        where: eq(postWhitelist.postId, postId),
        with: {
          user: whitelistUserRelationQuery,
        },
      })
      return items.map(i => i.user as { id: string, name: string | null, avatarUrl: string | null, email: string | null })
    })
  },

  async delete(id: string) {
    return measureDbQuery('posts', 'delete', async () => {
      return db.transaction(async (tx) => {
        const [post] = await tx.select().from(posts).where(eq(posts.id, id)).for('update')
        if (!post)
          return
        const media = await tx.query.postMedia.findMany({ where: eq(postMedia.postId, id) })
        await tx.insert(storageCleanupTasks).values({ prefix: `posts/${id}/`, keys: [...new Set(media.flatMap(postMediaStorageKeys))] })
        await tx.update(users).set({ currentStorageBytes: sql`GREATEST(0, ${users.currentStorageBytes} - ${media.reduce((sum, item) => sum + item.sizeBytes, 0)})` }).where(eq(users.id, post.userId))
        const [deleted] = await tx.delete(posts).where(eq(posts.id, id)).returning()
        return deleted
      })
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
    await db.execute(sql`
      UPDATE ${posts}
      SET views_count = views_count + 1,
          stats_detail = jsonb_set(
            stats_detail,
            '{views}',
            (COALESCE((stats_detail->>'views')::int, 0) + 1)::text::jsonb
          )
      WHERE id = ${id}
    `)
  },

  async getMediaByPostId(postId: string) {
    return await db.query.postMedia.findMany({
      where: eq(postMedia.postId, postId),
    })
  },

  async getUniqueTags(query?: string) {
    return measureDbQuery('posts', 'select', async () => {
      const searchParam = query ? `%${query}%` : '%'
      const result = await db.execute(sql`
        SELECT DISTINCT tag
        FROM ${posts}, jsonb_array_elements_text(${posts.tags}) AS tag
        WHERE tag ILIKE ${searchParam}
        ORDER BY tag
        LIMIT 20
      `)
      return result.rows.map(row => row.tag as string).filter(Boolean)
    })
  },
}
