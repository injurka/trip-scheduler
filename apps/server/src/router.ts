import { router } from './lib/trpc'
import { accountRouter } from './modules/account/account.router'
import { activityRouter } from './modules/activity/activity.router'
import { commentRouter } from './modules/comment/comment.router'
import { communityRouter } from './modules/community/community.router'
import { dayRouter } from './modules/day/day.router'
import { imageRouter } from './modules/image/image.router'
import { llmUsageRouter } from './modules/llm-usage/llm-usage.router'
import { memoryRouter } from './modules/memory/memory.router'
import { metroRouter } from './modules/metro/metro.router'
import { tripSectionRouter } from './modules/trip-section/trip-section.router'
import { tripRouter } from './modules/trip/trip.router'
import { userRouter } from './modules/user/user.router'

export const appRouter = router({
  trip: tripRouter,
  day: dayRouter,
  activity: activityRouter,
  image: imageRouter,
  memory: memoryRouter,
  user: userRouter,
  tripSection: tripSectionRouter,
  comment: commentRouter,
  account: accountRouter,
  community: communityRouter,
  llmUsage: llmUsageRouter,
  metro: metroRouter,
})

export type AppRouter = typeof appRouter
