import type { z } from 'zod'
import type { CreatePostInputSchema, ListPostsInputSchema, UpdatePostInputSchema } from './post.schemas'
import { createTRPCError } from '~/lib/trpc'
import { postRepository } from '~/repositories/post.repository'

export const postService = {
  async getAll(filters: z.infer<typeof ListPostsInputSchema>, userId?: string) {
    return await postRepository.findAll(filters, userId)
  },

  async getById(id: string, userId?: string) {
    const post = await postRepository.findById(id, userId)
    if (!post) {
      throw createTRPCError('NOT_FOUND', `Пост с ID ${id} не найден.`)
    }
    if (post.status === 'draft' && post.user.id !== userId) {
      throw createTRPCError('FORBIDDEN', 'Этот пост еще не опубликован.')
    }
    return post
  },

  async create(data: z.infer<typeof CreatePostInputSchema>, userId: string) {
    const newPost = await postRepository.create(data, userId)
    if (!newPost) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось создать пост.')
    }
    return newPost
  },

  async createMedia(
    postId: string,
    url: string,
    originalName: string,
    sizeBytes: number,
    metadata: any,
  ) {
    return await postRepository.createMedia({
      postId,
      url,
      originalName,
      sizeBytes,
      metadata,
      type: 'image',
    })
  },

  async update(input: z.infer<typeof UpdatePostInputSchema>, userId: string) {
    const existingPost = await postRepository.findById(input.id, userId)
    if (!existingPost) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    if (existingPost.user.id !== userId) {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на редактирование этого поста.')
    }

    const updated = await postRepository.update(input.id, input.data)
    if (!updated) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось обновить пост.')
    }
    return updated
  },

  async delete(id: string, userId: string) {
    const existingPost = await postRepository.findById(id, userId)
    if (!existingPost) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    if (existingPost.user.id !== userId) {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого поста.')
    }
    return await postRepository.delete(id)
  },
  async toggleSave(postId: string, userId: string) {
    const post = await postRepository.findById(postId)
    if (!post) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    const isSaved = await postRepository.toggleSave(postId, userId)
    return { isSaved }
  },

  async toggleLike(postId: string, userId: string) {
    const post = await postRepository.findById(postId)
    if (!post) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    const isLiked = await postRepository.toggleLike(postId, userId)
    return { isLiked }
  },

  async incrementView(postId: string) {
    await postRepository.incrementViewCount(postId)
    return { success: true }
  },
}
