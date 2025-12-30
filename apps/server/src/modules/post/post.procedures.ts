import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreatePostInputSchema,
  GetPostByIdInputSchema,
  ListPostsInputSchema,
  PostSchema,
  ToggleLikePostInputSchema,
  ToggleSavePostInputSchema,
  UpdatePostInputSchema,
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
      return postService.getAll(input, ctx.user?.id)
    }),

  getById: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/posts/{id}', tags: ['Posts'], summary: 'Получить пост по ID' } })
    .input(GetPostByIdInputSchema)
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      postService.incrementView(input.id).catch(console.error)
      return postService.getById(input.id, ctx.user?.id)
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
      return postService.update(input, ctx.user.id)
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/posts/{id}', tags: ['Posts'], summary: 'Удалить пост' } })
    .input(GetPostByIdInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await postService.delete(input.id, ctx.user.id)
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
}
