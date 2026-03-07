import type { IPostRepository } from '../model/types'
import type { CreatePostInput, ListPostsFilters, UpdatePostInput } from '~/shared/types/models/post'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class PostRepository implements IPostRepository {
  async list(filters: ListPostsFilters) {
    return trpc.post.list.query(filters)
  }

  async getById(params: { id: string }) {
    return trpc.post.getById.query(params)
  }

  async create(data: CreatePostInput) {
    return trpc.post.create.mutate(data)
  }

  async update(params: { id: string, data: Partial<UpdatePostInput> }) {
    return trpc.post.update.mutate(params)
  }

  async delete(params: { id: string }) {
    return trpc.post.delete.mutate(params)
  }

  async toggleSave(params: { postId: string }) {
    return trpc.post.toggleSave.mutate(params)
  }

  async toggleLike(params: { postId: string }) {
    return trpc.post.toggleLike.mutate(params)
  }
}
