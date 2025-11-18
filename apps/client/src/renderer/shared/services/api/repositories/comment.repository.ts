import type { ICommentRepository } from '../model/types'
import type { Comment, CreateCommentInput, UpdateCommentInput } from '~/shared/types/models/comment'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class CommentRepository implements ICommentRepository {
  async list(params: { parentId: string, page: number, limit: number }): Promise<{ data: Comment[], total: number }> {
    const result = await trpc.comment.list.query(params)
    return result as { data: Comment[], total: number }
  }

  async create(data: CreateCommentInput): Promise<Comment> {
    const result = await trpc.comment.create.mutate(data)
    return result as Comment
  }

  async update(data: UpdateCommentInput): Promise<Comment> {
    const result = await trpc.comment.update.mutate(data)
    return result as Comment
  }

  async delete(params: { commentId: string }): Promise<Comment> {
    const result = await trpc.comment.delete.mutate(params)
    return result as Comment
  }
}
