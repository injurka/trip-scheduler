import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { blogs } from '~/../db/schema'

export const BlogSchema = createSelectSchema(blogs)

export const BlogListItemSchema = BlogSchema.omit({ content: true })

export const ListBlogInputSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  cursor: z.string().optional(),
})

export const GetBlogBySlugInputSchema = z.object({
  slug: z.string(),
})
