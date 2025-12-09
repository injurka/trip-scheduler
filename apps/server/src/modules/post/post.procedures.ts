import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreatePostInputSchema,
  GetPostByIdInputSchema,
  ListPostsInputSchema,
  PostSchema,
  ToggleSavePostInputSchema,
  UpdatePostInputSchema,
} from './post.schemas'
import { postService } from './post.service'

// Схема ответа для списка
const PostListResponseSchema = z.object({
  items: z.array(PostSchema),
  nextCursor: z.string().optional(),
})

export const postProcedures = {
  // Получение ленты постов (публичное)
  list: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/posts',
        tags: ['Posts'],
        summary: 'Получить список постов (лента)',
      },
    })
    .input(ListPostsInputSchema)
    .output(PostListResponseSchema)
    .query(async ({ input, ctx }) => {
      return postService.getAll(input, ctx.user?.id)
    }),

  // Получение одного поста (публичное)
  getById: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/posts/{id}',
        tags: ['Posts'],
        summary: 'Получить пост по ID',
      },
    })
    .input(GetPostByIdInputSchema)
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      // Инкрементируем просмотр асинхронно
      postService.incrementView(input.id).catch(console.error)
      return postService.getById(input.id, ctx.user?.id)
    }),

  // Создание поста (защищенное)
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/posts',
        tags: ['Posts'],
        summary: 'Создать новый пост',
      },
    })
    .input(CreatePostInputSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return postService.create(input, ctx.user.id)
    }),

  // Обновление поста (защищенное)
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/posts/{id}',
        tags: ['Posts'],
        summary: 'Обновить пост',
      },
    })
    .input(UpdatePostInputSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return postService.update(input, ctx.user.id)
    }),

  // Удаление поста (защищенное)
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/posts/{id}',
        tags: ['Posts'],
        summary: 'Удалить пост',
      },
    })
    .input(GetPostByIdInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await postService.delete(input.id, ctx.user.id)
      return { id: deleted?.id ?? input.id }
    }),

  // Сохранить в закладки / Убрать (защищенное)
  toggleSave: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/posts/{postId}/save',
        tags: ['Posts'],
        summary: 'Добавить/Убрать пост из закладок',
      },
    })
    .input(ToggleSavePostInputSchema)
    .output(z.object({ isSaved: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return postService.toggleSave(input.postId, ctx.user.id)
    }),
}
