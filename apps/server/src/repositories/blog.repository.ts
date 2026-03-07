import type { z } from 'zod'
import type { CreateBlogInputSchema, UpdateBlogInputSchema } from '~/modules/blog/blog.schemas'
import { desc, eq, lt } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { blogs } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const blogRepository = {
  async findAll(limit: number, cursor?: string) {
    return measureDbQuery('blogs', 'select', async () => {
      const conditions = []

      if (cursor) {
        conditions.push(lt(blogs.publishedAt, new Date(cursor)))
      }

      const items = await db.query.blogs.findMany({
        where: conditions.length ? conditions[0] : undefined,
        limit: limit + 1,
        orderBy: [desc(blogs.publishedAt)],
        columns: {
          content: false,
        },
      })

      let nextCursor: string | undefined
      if (items.length > limit) {
        const nextItem = items.pop()
        nextCursor = nextItem?.publishedAt?.toISOString()
      }

      return { items, nextCursor }
    })
  },

  async findBySlug(slug: string) {
    return measureDbQuery('blogs', 'select', async () => {
      return await db.query.blogs.findFirst({
        where: eq(blogs.slug, slug),
      })
    })
  },

  async findById(id: string) {
    return measureDbQuery('blogs', 'select', async () => {
      return await db.query.blogs.findFirst({
        where: eq(blogs.id, id),
      })
    })
  },

  async create(data: z.infer<typeof CreateBlogInputSchema>) {
    return measureDbQuery('blogs', 'insert', async () => {
      const [newPost] = await db.insert(blogs).values({
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: data.published ? new Date() : null,
      }).returning()
      return newPost
    })
  },

  async update(id: string, data: z.infer<typeof UpdateBlogInputSchema>['data']) {
    return measureDbQuery('blogs', 'update', async () => {
      const updateData = {
        ...data,
        updatedAt: new Date(),
        ...(data.published === true ? { publishedAt: new Date() } : {}),
      }

      const [updatedPost] = await db.update(blogs)
        .set(updateData)
        .where(eq(blogs.id, id))
        .returning()

      return updatedPost
    })
  },

  async delete(id: string) {
    return measureDbQuery('blogs', 'delete', async () => {
      await db.delete(blogs).where(eq(blogs.id, id))
    })
  },
}
