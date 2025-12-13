import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CommentSchema,
  CreateCommentInputSchema,
  DeleteCommentInputSchema,
  DeleteCommentOutputSchema,
  GetCommentsInputSchema,
  PaginatedCommentsSchema,
  UpdateCommentInputSchema,
} from './comment.schemas'
import { commentService } from './comment.service'

export const commentProcedures = {
  list: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/comments',
        tags: ['Comments'],
        summary: 'Получить список комментариев',
      },
    })
    .input(GetCommentsInputSchema)
    .output(PaginatedCommentsSchema)
    .query(async ({ input }) => {
      return commentService.getByParent(input.parentId, input.limit, input.page)
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/comments',
        tags: ['Comments'],
        summary: 'Создать комментарий',
        protect: true,
      },
    })
    .input(CreateCommentInputSchema)
    .output(CommentSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.create(input, ctx.user.id.toString())
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/comments/{commentId}',
        tags: ['Comments'],
        summary: 'Обновить комментарий',
        protect: true,
      },
    })
    .input(UpdateCommentInputSchema)
    .output(CommentSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.update(input, ctx.user.id.toString())
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/comments/{commentId}',
        tags: ['Comments'],
        summary: 'Удалить комментарий',
        protect: true,
      },
    })
    .input(DeleteCommentInputSchema)
    .output(DeleteCommentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.delete(input.commentId, ctx.user.id.toString())
    }),
}
