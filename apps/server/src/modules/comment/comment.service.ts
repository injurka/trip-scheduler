import type { z } from 'zod'
import type { CreateCommentInputSchema, UpdateCommentInputSchema } from './comment.schemas'
import { createTRPCError } from '~/lib/trpc'
import { commentRepository } from '~/repositories/comment.repository'

export const commentService = {
  async getByParent(parentId: string, limit: number, page: number) {
    return await commentRepository.getByParent(parentId, limit, page)
  },

  async create(data: z.infer<typeof CreateCommentInputSchema>, userId: string) {
    // В будущем здесь можно добавить проверку, имеет ли пользователь доступ к parentId
    return await commentRepository.create({ ...data, userId })
  },

  async update(data: z.infer<typeof UpdateCommentInputSchema>, userId: string) {
    const comment = await commentRepository.findById(data.commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${data.commentId} не найден.`)
    }
    if (comment.userId !== userId) {
      throw createTRPCError('FORBIDDEN', 'Вы не можете редактировать чужие комментарии.')
    }
    return await commentRepository.update(data.commentId, data.text)
  },

  async delete(commentId: string, userId: string) {
    const comment = await commentRepository.findById(commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${commentId} не найден.`)
    }
    // TODO: В будущем добавить проверку на владельца путешествия
    if (comment.userId !== userId) {
      throw createTRPCError('FORBIDDEN', 'Вы не можете удалять чужие комментарии.')
    }
    return await commentRepository.delete(commentId)
  },
}
