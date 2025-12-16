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
}
