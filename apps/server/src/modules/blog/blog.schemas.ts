import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { blogs } from '~/../db/schema'

export const BlogSchema = createSelectSchema(blogs)

export const BlogListItemSchema = BlogSchema.omit({ content: true })

// --- Input Schemas ---

export const ListBlogInputSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  cursor: z.string().optional(),
})

export const GetBlogBySlugInputSchema = z.object({
  slug: z.string(),
})

export const CreateBlogInputSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен'),
  slug: z.string().min(1, 'Slug обязателен').regex(/^[a-z0-9-]+$/, 'Slug может содержать только буквы, цифры и дефис'),
  content: z.string().min(1, 'Контент обязателен'),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  published: z.boolean().default(false),
})

export const UpdateBlogInputSchema = z.object({
  id: z.string().uuid(),
  data: CreateBlogInputSchema.partial(),
})

export const DeleteBlogInputSchema = z.object({
  id: z.string().uuid(),
})

export const GetBlogByIdInputSchema = z.object({
  id: z.string().uuid(),
})
