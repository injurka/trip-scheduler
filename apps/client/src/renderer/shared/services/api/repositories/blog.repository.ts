import type { IBlogRepository } from '../model/types'
import type { CreateBlogPostInput, UpdateBlogPostInput } from '~/shared/types/models/blog'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class BlogRepository implements IBlogRepository {
  async list(limit: number, cursor?: string) {
    return await trpc.blog.list.query({ limit, cursor })
  }

  async getBySlug(slug: string) {
    return await trpc.blog.getBySlug.query({ slug })
  }

  async getById(id: string) {
    return await trpc.blog.getById.query({ id })
  }

  async create(data: CreateBlogPostInput) {
    return await trpc.blog.create.mutate(data)
  }

  async update(data: UpdateBlogPostInput) {
    return await trpc.blog.update.mutate(data)
  }

  async delete(id: string) {
    return await trpc.blog.delete.mutate({ id })
  }
}
