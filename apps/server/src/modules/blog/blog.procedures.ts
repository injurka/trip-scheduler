import { z } from 'zod'
import { publicProcedure } from '~/lib/trpc'
import { BlogListItemSchema, BlogSchema, GetBlogBySlugInputSchema, ListBlogInputSchema } from './blog.schemas'
import { blogService } from './blog.service'

export const blogProcedures = {
  list: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/blog',
        tags: ['Blog'],
        summary: 'Получить список статей блога',
      },
    })
    .input(ListBlogInputSchema)
    .output(z.object({
      items: z.array(BlogListItemSchema),
      nextCursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return blogService.getList(input.limit, input.cursor)
    }),

  getBySlug: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/blog/{slug}',
        tags: ['Blog'],
        summary: 'Получить статью по слагу',
      },
    })
    .input(GetBlogBySlugInputSchema)
    .output(BlogSchema)
    .query(async ({ input }) => {
      return blogService.getBySlug(input.slug)
    }),
}
