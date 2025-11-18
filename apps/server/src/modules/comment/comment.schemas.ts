import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { commentParentTypeEnum, comments } from '~/../db/schema'
import { UserSchema } from '~/modules/user/user.schemas'

// Схема для вывода (включает данные пользователя)
export const CommentSchema = createSelectSchema(comments).extend({
  user: UserSchema.pick({ id: true, name: true, avatarUrl: true }),
})

// Схемы для ввода (Input)
export const GetCommentsInputSchema = z.object({
  parentId: z.string().uuid(),
  limit: z.number().min(1).max(100).optional().default(20),
  page: z.number().min(1).optional().default(1),
})

export const CreateCommentInputSchema = z.object({
  text: z.string().min(1, 'Комментарий не может быть пустым.'),
  parentId: z.string().uuid(),
  parentType: z.enum(commentParentTypeEnum.enumValues),
})

export const UpdateCommentInputSchema = z.object({
  commentId: z.string().uuid(),
  text: z.string().min(1, 'Комментарий не может быть пустым.'),
})

export const DeleteCommentInputSchema = z.object({
  commentId: z.string().uuid(),
})
