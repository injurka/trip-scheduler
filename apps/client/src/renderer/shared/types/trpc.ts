// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
// @ts-expect-error - другой проект
import type { AppRouter } from '@xsolare/trip-scheduler-server/router'

// eslint-disable-next-line perfectionist/sort-imports
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>
export type { AppRouter }
