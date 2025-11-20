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

// --- Аутентификация ---
const SignIn = () => import('~/pages/auth/sign-in.vue')
const SignUp = () => import('~/pages/auth/sign-up.vue')
const AuthCallback = () => import('~/pages/auth/callback.vue')
const ForgotPassword = () => import('~/pages/auth/forgot-password.vue')

// --- Путешествия ---
const TripList = () => import('~/pages/trip/list.vue')
const TripInfo = () => import('~/pages/trip/[id]/index.vue')

// --- Пользователь (Новая структура) ---
// Обратите внимание на импорты из новой структуры папок
const UserProfile = () => import('~/pages/user/[id]/index.vue')
const UserSettings = () => import('~/pages/user/[id]/settings.vue')
const UserQuota = () => import('~/pages/user/[id]/quota.vue')
const UserStorage = () => import('~/pages/user/[id]/storage.vue')

// --- Сообщества ---
const CommunitiesList = () => import('~/pages/communities/index.vue')
const CommunityInfo = () => import('~/pages/communities/[id].vue')

const ExplorePage = () => import('~/pages/explore.vue')

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
