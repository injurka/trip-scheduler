import type { IPostRepository } from '../model/types'
import type { CreatePostInput, ListPostsFilters, PostDetail, UpdatePostInput } from '~/shared/types/models/post'
import type { RouterOutput } from '~/shared/types/trpc'
import { trpc } from '~/shared/services/trpc/trpc.service'

export function normalizePost(post: RouterOutput['post']['getById']): PostDetail {
  return {
    ...post,
    description: post.description ?? undefined,
    country: post.country ?? undefined,
    latitude: post.latitude ?? 0,
    longitude: post.longitude ?? 0,
    media: (post.media ?? []).map(media => ({
      ...media,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
    })),
    elements: (post.elements ?? []).map(element => ({ ...element, title: element.title ?? undefined })),
  }
}

export class PostRepository implements IPostRepository {
  async list(filters: ListPostsFilters) {
    const result = await trpc.post.list.query(filters)

    return { ...result, items: result.items.map(normalizePost) }
  }

  async getById(params: { id: string }) {
    return normalizePost(await trpc.post.getById.query(params))
  }

  async create(data: CreatePostInput) {
    return normalizePost(await trpc.post.create.mutate(data))
  }

  async update(params: { id: string, data: Partial<UpdatePostInput> }) {
    return normalizePost(await trpc.post.update.mutate(params))
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

  async getUniqueTags(params: { query?: string }) {
    return trpc.post.getUniqueTags.query(params)
  }

  async describeMediaTimeline(params: { groups: { id: number, count: number, frame: string }[] }) {
    return trpc.post.describeMediaTimeline.mutate(params)
  }

  async generateFromText(params: { text: string }) {
    return trpc.post.generateFromText.mutate(params)
  }

  async deleteMedia(params: { id: string }) {
    return trpc.post.deleteMedia.mutate(params)
  }

  async updateMediaPrivacy(params: { mediaId: string, isPrivate: boolean }) {
    return trpc.post.updateMediaPrivacy.mutate(params)
  }

  async addWhitelistUser(params: { postId: string, userId: string }) {
    return trpc.post.addWhitelistUser.mutate(params)
  }

  async removeWhitelistUser(params: { postId: string, userId: string }) {
    return trpc.post.removeWhitelistUser.mutate(params)
  }

  async getWhitelist(params: { id: string }) {
    return trpc.post.getWhitelist.query(params)
  }
}
