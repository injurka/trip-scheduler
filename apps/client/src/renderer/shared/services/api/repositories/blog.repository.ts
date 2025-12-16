import type { IBlogRepository } from '../model/types'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class BlogRepository implements IBlogRepository {
  async list(limit: number, cursor?: string) {
    return await trpc.blog.list.query({ limit, cursor })
  }

  async getBySlug(slug: string) {
    return await trpc.blog.getBySlug.query({ slug })
  }
}
