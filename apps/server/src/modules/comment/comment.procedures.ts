import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateCommentInputSchema,
  DeleteCommentInputSchema,
  GetCommentsInputSchema,
  UpdateCommentInputSchema,
} from './comment.schemas'
import { commentService } from './comment.service'

export const commentProcedures = {
  list: publicProcedure // Комментарии могут просматривать все, у кого есть доступ к сущности
    .input(GetCommentsInputSchema)
    .query(async ({ input }) => {
      return commentService.getByParent(input.parentId, input.limit, input.page)
    }),

  create: protectedProcedure // Создавать могут только авторизованные
    .input(CreateCommentInputSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.create(input, ctx.user.id)
    }),

  update: protectedProcedure // Обновлять могут только авторизованные
    .input(UpdateCommentInputSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.update(input, ctx.user.id)
    }),

  delete: protectedProcedure // Удалять могут только авторизованные
    .input(DeleteCommentInputSchema)
    .mutation(async ({ input, ctx }) => {
      return commentService.delete(input.commentId, ctx.user.id)
    }),
}
