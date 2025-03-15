import type { Router, RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { AppRouteNames, AppRoutePaths } from '~/shared/types/routes'

const TripMain = () => import('~/pages/trip.vue')
const NotFound = () => import('~/pages/not-found.vue')

const routes: RouteRecordRaw[] = [
  {
    path: AppRoutePaths.TripMain,
    name: AppRouteNames.TripMain,
    component: TripMain,
    meta: {
      layout: 'base',
    },
  },
  {
    path: AppRoutePaths.NotFound,
    name: AppRouteNames.NotFound,
    component: NotFound,
    meta: {
      layout: 'base',
    },
  },
]

const router: Router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router
