import type { z } from 'zod'
import type { CreateBlogInputSchema, UpdateBlogInputSchema } from './blog.schemas'
import { createTRPCError } from '~/lib/trpc'
import { blogRepository } from '~/repositories/blog.repository'

export const blogService = {
  async getList(limit: number, cursor?: string) {
    return await blogRepository.findAll(limit, cursor)
  },

  async getBySlug(slug: string) {
    const post = await blogRepository.findBySlug(slug)
    if (!post) {
      throw createTRPCError('NOT_FOUND', 'Статья не найдена')
    }
    return post
  },

  async getById(id: string) {
    const post = await blogRepository.findById(id)
    if (!post) {
      throw createTRPCError('NOT_FOUND', 'Статья не найдена')
    }
    return post
  },

  async create(data: z.infer<typeof CreateBlogInputSchema>, userRole: string) {
    if (userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Только администраторы могут создавать новости.')
    }

    const existing = await blogRepository.findBySlug(data.slug)
    if (existing) {
      throw createTRPCError('CONFLICT', 'Статья с таким URL уже существует.')
    }

    return await blogRepository.create(data)
  },

  async update(input: z.infer<typeof UpdateBlogInputSchema>, userRole: string) {
    if (userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Только администраторы могут редактировать новости.')
    }

    const existing = await blogRepository.findById(input.id)
    if (!existing) {
      throw createTRPCError('NOT_FOUND', 'Статья не найдена.')
    }

    return await blogRepository.update(input.id, input.data)
  },

  async updateCoverImage(id: string, imageUrl: string) {
    return await blogRepository.update(id, { coverImage: imageUrl })
  },

  async delete(id: string, userRole: string) {
    if (userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Только администраторы могут удалять новости.')
    }

    const existing = await blogRepository.findById(id)
    if (!existing) {
      throw createTRPCError('NOT_FOUND', 'Статья не найдена.')
    }

    await blogRepository.delete(id)
  },
}
