import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  BlogListItemSchema,
  BlogSchema,
  CreateBlogInputSchema,
  DeleteBlogInputSchema,
  GetBlogByIdInputSchema,
  GetBlogBySlugInputSchema,
  ListBlogInputSchema,
  UpdateBlogInputSchema,
} from './blog.schemas'
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
        path: '/blog/slug/{slug}',
        tags: ['Blog'],
        summary: 'Получить статью по слагу',
      },
    })
    .input(GetBlogBySlugInputSchema)
    .output(BlogSchema)
    .query(async ({ input }) => {
      return blogService.getBySlug(input.slug)
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/blog/{id}',
        tags: ['Blog'],
        summary: 'Получить статью по ID',
      },
    })
    .input(GetBlogByIdInputSchema)
    .output(BlogSchema)
    .query(async ({ input }) => {
      return blogService.getById(input.id)
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/blog',
        tags: ['Blog'],
        summary: 'Создать статью',
      },
    })
    .input(CreateBlogInputSchema)
    .output(BlogSchema)
    .mutation(async ({ input, ctx }) => {
      return blogService.create(input, ctx.user.role)
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/blog',
        tags: ['Blog'],
        summary: 'Обновить статью',
      },
    })
    .input(UpdateBlogInputSchema)
    .output(BlogSchema)
    .mutation(async ({ input, ctx }) => {
      return blogService.update(input, ctx.user.role)
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/blog/{id}',
        tags: ['Blog'],
        summary: 'Удалить статью',
      },
    })
    .input(DeleteBlogInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return blogService.delete(input.id, ctx.user.role)
    }),
}
