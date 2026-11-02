import type { AppRouter } from '@injurka/trip-scheduler-server/router'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>
export type { AppRouter }
