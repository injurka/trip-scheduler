import { desc, eq, lt } from 'drizzle-orm'
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
}
