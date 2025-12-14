import { router } from './lib/trpc'
import { activityRouter } from './modules/activity/activity.router'
import { commentRouter } from './modules/comment/comment.router'
import { dayRouter } from './modules/day/day.router'
import { metroRouter } from './modules/metro/metro.router'
import { tripSectionRouter } from './modules/trip-section/trip-section.router'
import { tripRouter } from './modules/trip/trip.router'
import { userRouter } from './modules/user/user.router'

export const appRouter = router({
  user: userRouter,
  comment: commentRouter,
  metro: metroRouter,
  day: dayRouter,
  tripSection: tripSectionRouter,
  trip: tripRouter,
  activity: activityRouter,
})

export type AppRouter = typeof appRouter
