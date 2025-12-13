import type { Router, RouteRecordRaw, RouterScrollBehavior } from 'vue-router'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { AppRouteNames, AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

const isElectron = !!window.electronAPI

// --- Компоненты страниц ---
const Root = () => import('~/pages/root.vue')
const NotFound = () => import('~/pages/not-found.vue')
const About = () => import('~/pages/about.vue')
const UsefulLinks = () => import('~/pages/useful-links.vue')
const Terms = () => import('~/pages/terms.vue')
const Privacy = () => import('~/pages/privacy.vue')
const OssLicenses = () => import('~/pages/oss-licenses.vue')

// --- Аутентификация ---
const SignIn = () => import('~/pages/auth/sign-in.vue')
const SignUp = () => import('~/pages/auth/sign-up.vue')
const AuthCallback = () => import('~/pages/auth/callback.vue')
const ForgotPassword = () => import('~/pages/auth/forgot-password.vue')

// --- Путешествия ---
const TripList = () => import('~/pages/trip/list.vue')
const TripInfo = () => import('~/pages/trip/[id]/index.vue')

// --- Пользователь (Новая структура) ---
const UserProfile = () => import('~/pages/user/[id]/index.vue')
const UserSettings = () => import('~/pages/user/[id]/settings.vue')
const UserQuota = () => import('~/pages/user/[id]/quota.vue')
const UserStorage = () => import('~/pages/user/[id]/storage.vue')

const ExplorePage = () => import('~/pages/explore.vue')
const PostListPage = () => import('~/pages/post/list.vue')

// Guard для проверки, что пользователь заходит в свои настройки
async function requireOwner(to: any, _from: any, next: any) {
  const authStore = useAuthStore()
  // Ждем инициализации, если перезагрузили страницу
  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unsubscribe = authStore.$subscribe((_, state) => {
        if (state.isInitialized) {
          unsubscribe()
          resolve()
        }
      })
    })
  }

  if (authStore.user?.id === to.params.id) {
    next()
  }
  else {
    // Если пытаются зайти в чужие настройки -> редирект на профиль этого пользователя
    next({ name: AppRouteNames.UserProfile, params: { id: to.params.id } })
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: AppRoutePaths.Root,
    name: AppRouteNames.Root,
    component: Root,
  },
  {
    path: AppRoutePaths.About,
    name: AppRouteNames.About,
    component: About,
  },
  {
    path: AppRoutePaths.UsefulLinks,
    name: AppRouteNames.UsefulLinks,
    component: UsefulLinks,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Terms,
    name: AppRouteNames.Terms,
    component: Terms,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Privacy,
    name: AppRouteNames.Privacy,
    component: Privacy,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.OssLicenses,
    name: AppRouteNames.OssLicenses,
    component: OssLicenses,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Auth.SignIn,
    name: AppRouteNames.SignIn,
    component: SignIn,
    meta: { layout: 'empty' },
  },
  {
    path: AppRoutePaths.Auth.SignUp,
    name: AppRouteNames.SignUp,
    component: SignUp,
    meta: { layout: 'empty' },
  },
  {
    path: AppRoutePaths.Auth.ForgotPassword,
    name: AppRouteNames.ForgotPassword,
    component: ForgotPassword,
    meta: { layout: 'empty' },
  },
  {
    path: AppRoutePaths.Auth.Callback,
    name: AppRouteNames.AuthCallback,
    component: AuthCallback,
    meta: { layout: 'empty' },
  },

  // --- Путешествия ---
  {
    path: AppRoutePaths.Trip.List,
    name: AppRouteNames.TripList,
    component: TripList,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Trip.Info(':id'),
    name: AppRouteNames.TripInfo,
    component: TripInfo,
    meta: { layout: 'trip-info' },
  },

  // --- Пользователь ---
  {
    path: '/user/:id',
    name: AppRouteNames.UserProfile,
    component: UserProfile,
    meta: { layout: 'default' },
  },
  {
    path: '/user/:id/settings',
    name: AppRouteNames.UserSettings,
    component: UserSettings,
    meta: { layout: 'default', requiresAuth: true },
    beforeEnter: requireOwner,
  },
  {
    path: '/user/:id/quota',
    name: AppRouteNames.UserQuota,
    component: UserQuota,
    meta: { layout: 'default', requiresAuth: true },
    beforeEnter: requireOwner,
  },
  {
    path: '/user/:id/storage',
    name: AppRouteNames.UserStorage,
    component: UserStorage,
    meta: { layout: 'default', requiresAuth: true },
    beforeEnter: requireOwner,
  },

  // --- Посты ---
  {
    path: '/post/list',
    name: AppRouteNames.PostList,
    component: PostListPage,
    meta: { layout: 'default', requiresAuth: true },
  },

  // --- Системные маршруты ---
  {
    path: AppRoutePaths.NotFound,
    name: AppRouteNames.NotFound,
    component: NotFound,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Explore,
    name: AppRouteNames.Explore,
    component: ExplorePage,
    meta: { layout: 'default' },
  },
]

const scrollBehavior: RouterScrollBehavior = (_to, _from, savedPosition) => {
  if (savedPosition) {
    return savedPosition
  }
  else {
    return { top: 0 }
  }
}

const router: Router = createRouter({
  history: isElectron ? createWebHashHistory() : createWebHistory('/'),
  routes,
  scrollBehavior,
})

router.beforeEach(async (to, _, next) => {
  const authStore = useAuthStore()

  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unsubscribe = authStore.$subscribe((_, state) => {
        if (state.isInitialized) {
          unsubscribe()
          resolve()
        }
      })
    })
  }

  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !authStore.isAuthenticated) {
    return next({
      name: AppRouteNames.SignIn,
      query: { returnUrl: to.fullPath },
    })
  }

  if (authStore.isAuthenticated && (to.name === AppRouteNames.SignIn || to.name === AppRouteNames.SignUp)) {
    return next({ name: AppRouteNames.TripList })
  }

  next()
})

export default router
