import { z } from 'zod'
import { UserSchema } from '~/modules/user/user.schemas'

export const CommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  parentId: z.string(),
  parentType: z.enum(['trip', 'day']),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),

  user: UserSchema.pick({ id: true, name: true, avatarUrl: true }),
})

export const GetCommentsInputSchema = z.object({
  parentId: z.string(),
  limit: z.number().min(1).max(100).optional().default(20),
  page: z.number().min(1).optional().default(1),
})

export const CreateCommentInputSchema = z.object({
  text: z.string().min(1),
  parentId: z.string(),
  parentType: z.enum(['trip', 'day']),
})

export const UpdateCommentInputSchema = z.object({
  commentId: z.string(),
  text: z.string().min(1),
})

export const DeleteCommentInputSchema = z.object({
  commentId: z.string(),
})

export const DeleteCommentOutputSchema = z.object({
  id: z.string(),
})

export const PaginatedCommentsSchema = z.object({
  data: z.array(CommentSchema),
  total: z.number(),
})
