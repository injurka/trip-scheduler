import { router } from './lib/trpc'
import { commentRouter } from './modules/comment/comment.router'
import { metroRouter } from './modules/metro/metro.router'

import { userRouter } from './modules/user/user.router'

export const appRouter = router({
  user: userRouter,
  comment: commentRouter,
  metro: metroRouter,
})

export type AppRouter = typeof appRouter
