import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { postGenerationService } from '~/services/llm/post-generation.service'
import {
  AiGeneratedPostOutputSchema,
  CreatePostInputSchema,
  DeletePostMediaInputSchema,
  GeneratePostInputSchema,
  GetPostByIdInputSchema,
  ListPostsInputSchema,
  ManageWhitelistUserInputSchema,
  PostSchema,
  ToggleLikePostInputSchema,
  ToggleSavePostInputSchema,
  UpdateMediaPrivacyInputSchema,
  UpdatePostInputSchema,
  WhitelistUserSchema,
} from './post.schemas'
import { postService } from './post.service'

const PostListResponseSchema = z.object({
  items: z.array(PostSchema),
  nextCursor: z.string().optional(),
})

export const postProcedures = {
  list: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/posts', tags: ['Posts'], summary: 'Получить список постов (лента)' } })
    .input(ListPostsInputSchema)
    .output(PostListResponseSchema)
    .query(async ({ input, ctx }) => {
      return postService.getAll(input, ctx.user?.id, ctx.user?.role)
    }),

  getById: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/posts/{id}', tags: ['Posts'], summary: 'Получить пост по ID' } })
    .input(GetPostByIdInputSchema)
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      postService.incrementViewCount(input.id).catch(console.error)
      return postService.getById(input.id, ctx.user?.id, ctx.user?.role)
    }),

  create: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/posts', tags: ['Posts'], summary: 'Создать новый пост' } })
    .input(CreatePostInputSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return postService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/posts/{id}', tags: ['Posts'], summary: 'Обновить пост' } })
    .input(UpdatePostInputSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return postService.update(input, ctx.user.id, ctx.user.role)
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/posts/{id}', tags: ['Posts'], summary: 'Удалить пост' } })
    .input(GetPostByIdInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await postService.delete(input.id, ctx.user.id, ctx.user.role)
      return { id: deleted?.id ?? input.id }
    }),

  toggleSave: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/posts/{postId}/save', tags: ['Posts'], summary: 'Добавить/Убрать пост из закладок' } })
    .input(ToggleSavePostInputSchema)
    .output(z.object({ isSaved: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return postService.toggleSave(input.postId, ctx.user.id)
    }),

  toggleLike: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/posts/{postId}/like', tags: ['Posts'], summary: 'Поставить/убрать лайк' } })
    .input(ToggleLikePostInputSchema)
    .output(z.object({ isLiked: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return postService.toggleLike(input.postId, ctx.user.id)
    }),

  getUniqueTags: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/posts/tags', tags: ['Posts'], summary: 'Получить уникальные теги постов' } })
    .input(z.object({ query: z.string().optional() }))
    .output(z.array(z.string()))
    .query(async ({ input }) => {
      return postService.getUniqueTags(input.query)
    }),

  generateFromText: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/posts/generate', tags: ['Posts'], summary: 'Сгенерировать структуру поста с помощью ИИ' } })
    .input(GeneratePostInputSchema)
    .output(AiGeneratedPostOutputSchema)
    .mutation(async ({ input, ctx }) => {
      return postGenerationService.generateFromText(ctx.user.id, input.text)
    }),

  deleteMedia: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/posts/media/{id}', tags: ['Posts'], summary: 'Удалить медиа поста' } })
    .input(DeletePostMediaInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await postService.deleteMedia(input.id, ctx.user.id, ctx.user.role)
      return { success: true }
    }),

  updateMediaPrivacy: protectedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/posts/media/{mediaId}/privacy', tags: ['Posts'], summary: 'Обновить приватность медиафайла поста' } })
    .input(UpdateMediaPrivacyInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await postService.updateMediaPrivacy(input.mediaId, input.isPrivate, ctx.user.id, ctx.user.role)
      return { success: true }
    }),

  addWhitelistUser: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/posts/{postId}/whitelist', tags: ['Posts'], summary: 'Добавить пользователя в белый список поста' } })
    .input(ManageWhitelistUserInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return postService.addWhitelistUser(input.postId, input.userId, ctx.user.id, ctx.user.role)
    }),

  removeWhitelistUser: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/posts/{postId}/whitelist/{userId}', tags: ['Posts'], summary: 'Удалить пользователя из белого списка поста' } })
    .input(ManageWhitelistUserInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return postService.removeWhitelistUser(input.postId, input.userId, ctx.user.id, ctx.user.role)
    }),

  getWhitelist: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/posts/{id}/whitelist', tags: ['Posts'], summary: 'Получить белый список пользователей поста' } })
    .input(GetPostByIdInputSchema)
    .output(z.array(WhitelistUserSchema))
    .query(async ({ input, ctx }) => {
      return postService.getWhitelist(input.id, ctx.user.id, ctx.user.role)
    }),
}
