import type { z } from 'zod'
import type { CreateCommentInputSchema, UpdateCommentInputSchema } from './comment.schemas'
import { createTRPCError } from '~/lib/trpc'
import { commentRepository } from '~/modules/comment/comment.repository'

export const commentService = {
  async getByParent(parentId: string, limit: number, page: number) {
    return await commentRepository.getByParent(parentId, limit, page)
  },

  async create(data: z.infer<typeof CreateCommentInputSchema>, userId: string) {
    const newComment = await commentRepository.create({ ...data, userId })
    if (!newComment) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось создать комментарий.')
    }
    return newComment
  },

  async update(data: z.infer<typeof UpdateCommentInputSchema>, userId: string) {
    const comment = await commentRepository.findById(data.commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${data.commentId} не найден.`)
    }

    const ownerId = comment.user.toString().split(':')[1]

    if (ownerId !== userId) {
      throw createTRPCError('FORBIDDEN', 'Вы не можете редактировать чужие комментарии.')
    }

    const updatedComment = await commentRepository.update(data.commentId, data.text)
    if (!updatedComment) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось обновить комментарий.')
    }
    return updatedComment
  },

  async delete(commentId: string, userId: string) {
    const comment = await commentRepository.findById(commentId)
    if (!comment) {
      throw createTRPCError('NOT_FOUND', `Комментарий с ID ${commentId} не найден.`)
    }

    const ownerId = comment.user.toString().split(':')[1]

    if (ownerId !== userId) {
      throw createTRPCError('FORBIDDEN', 'Вы не можете удалять чужие комментарии.')
    }
    return await commentRepository.delete(commentId)
  },
}
