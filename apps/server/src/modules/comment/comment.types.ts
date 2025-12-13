import type z from 'zod'
import type { CommentSchema } from './comment.schemas'

export type Comment = z.infer<typeof CommentSchema>
export type CommentRecord = Omit<Comment, 'user'> & {
  user: string
}
