import type { z } from 'zod'
import type { CreateCommentInputSchema, UpdateCommentInputSchema } from './comment.schemas'
import { createTRPCError } from '~/lib/trpc'
import { commentRepository } from '~/repositories/comment.repository'

export const commentService = {
  async getByParent(parentId: string, limit: number, page: number) {
    return await commentRepository.getByParent(parentId, limit, page)
  },

  async create(data: z.infer<typeof CreateCommentInputSchema>, userId: string) {
    return await commentRepository.create({ ...data, userId })
  },

  async update(data: z.infer<typeof UpdateCommentInputSchema>, userId: string, userRole: string) {
    const comment = await commentRepository.findById(data.commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${data.commentId} не найден.`)
    }
    if (comment.userId !== userId && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Вы не можете редактировать чужие комментарии.')
    }
    return await commentRepository.update(data.commentId, data.text)
  },

  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await commentRepository.findById(commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${commentId} не найден.`)
    }
    if (comment.userId !== userId && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Вы не можете удалять чужие комментарии.')
    }
    return await commentRepository.delete(commentId)
  },
}
