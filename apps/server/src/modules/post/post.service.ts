import type { z } from 'zod'
import type { CreatePostInputSchema, ListPostsInputSchema, UpdatePostInputSchema } from './post.schemas'
import { createTRPCError } from '~/lib/trpc'
import { postRepository } from '~/repositories/post.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'

export const postService = {
  async getAll(filters: z.infer<typeof ListPostsInputSchema>, userId?: string) {
    return await postRepository.findAll(filters, userId)
  },

  async getById(id: string, userId?: string, userRole?: string) {
    const post = await postRepository.findById(id, userId)
    if (!post) {
      throw createTRPCError('NOT_FOUND', `Пост с ID ${id} не найден.`)
    }
    if (post.status === 'draft' && post.user.id !== userId && userRole !== 'admin') {
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

  async update(input: z.infer<typeof UpdatePostInputSchema>, userId: string, userRole: string) {
    const existingPost = await postRepository.findById(input.id, userId)
    if (!existingPost) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    if (existingPost.user.id !== userId && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на редактирование этого поста.')
    }

    let mediaToDelete: any[] = []
    if (input.data.mediaIds !== undefined) {
      const existingMedia = await postRepository.getMediaByPostId(input.id)
      mediaToDelete = existingMedia.filter(m => !input.data.mediaIds!.includes(m.id))
    }

    const updated = await postRepository.update(input.id, input.data)
    if (!updated) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось обновить пост.')
    }

    if (mediaToDelete.length > 0) {
      for (const media of mediaToDelete) {
        await deleteFileWithVariants({
          url: media.url,
          variants: media.metadata?.variants || {},
        }).catch(e => console.error(`Failed to delete post media ${media.id} from S3`, e))

        await quotaService.decrementStorageUsage(existingPost.user.id, media.sizeBytes).catch(console.error)
      }
    }

    return updated
  },

  async delete(id: string, userId: string, userRole: string) {
    const existingPost = await postRepository.findById(id, userId)
    if (!existingPost) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    if (existingPost.user.id !== userId && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого поста.')
    }

    const existingMedia = await postRepository.getMediaByPostId(id)

    const deleted = await postRepository.delete(id)

    for (const media of existingMedia) {
      await deleteFileWithVariants({
        url: media.url,
        variants: media.metadata?.variants || {},
      }).catch(e => console.error(`Failed to delete post media ${media.id} from S3`, e))

      await quotaService.decrementStorageUsage(existingPost.user.id, media.sizeBytes).catch(console.error)
    }

    return deleted
  },

  async deleteMedia(mediaId: string, userId: string, userRole: string) {
    const media = await postRepository.getMediaById(mediaId)

    if (!media) {
      throw createTRPCError('NOT_FOUND', 'Медиа не найдено')
    }

    if (media.post.userId !== userId && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого медиа.')
    }

    await postRepository.deleteMedia(mediaId)

    await deleteFileWithVariants({
      url: media.url,
      variants: (media.metadata as any)?.variants || {},
    }).catch(e => console.error(`Failed to delete post media ${media.id} from S3`, e))

    await quotaService.decrementStorageUsage(media.post.userId, media.sizeBytes).catch(console.error)

    return { success: true }
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

  async incrementViewCount(id: string) {
    await postRepository.incrementViewCount(id)
    return { success: true }
  },

  async getUniqueTags(query?: string) {
    return await postRepository.getUniqueTags(query)
  },
}
