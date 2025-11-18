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

// --- Аккаунт ---
const QuotaPage = () => import('~/pages/account/quota.vue')
const StoragePage = () => import('~/pages/account/storage.vue')
const ProfilePage = () => import('~/pages/account/profile.vue')
const SettingsPage = () => import('~/pages/account/settings.vue')

// --- Сообщества ---
const CommunitiesList = () => import('~/pages/communities/index.vue')
const CommunityInfo = () => import('~/pages/communities/[id].vue')

const ExplorePage = () => import('~/pages/explore.vue')

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

  // --- Основные маршруты приложения (требуют авторизации) ---
  {
    // Список путешествий
    path: AppRoutePaths.Trip.List,
    name: AppRouteNames.TripList,
    component: TripList,
    meta: { layout: 'default' },
  },
  {
    // Маршрут по дням (план + воспоминания)
    path: AppRoutePaths.Trip.Info(':id'),
    name: AppRouteNames.TripInfo,
    component: TripInfo,
    meta: { layout: 'trip-info' },
  },
  {
    path: AppRoutePaths.Account.Quota,
    name: AppRouteNames.AccountQuota,
    component: QuotaPage,
    meta: { layout: 'default', requiresAuth: true },
  },
  {
    path: AppRoutePaths.Account.Storage,
    name: AppRouteNames.AccountStorage,
    component: StoragePage,
    meta: { layout: 'default', requiresAuth: true },
  },
  {
    path: AppRoutePaths.Account.Profile,
    name: AppRouteNames.AccountProfile,
    component: ProfilePage,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Account.Settings,
    name: AppRouteNames.AccountSettings,
    component: SettingsPage,
    meta: { layout: 'default', requiresAuth: true },
  },
  {
    path: AppRoutePaths.Communities.List,
    name: AppRouteNames.CommunitiesList,
    component: CommunitiesList,
    meta: { layout: 'default' },
  },
  {
    path: AppRoutePaths.Communities.Info(':id'),
    name: AppRouteNames.CommunityInfo,
    component: CommunityInfo,
    meta: { layout: 'default' },
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

// --- Глобальный навигационный гард ---
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

  // Если пользователь авторизован и пытается зайти на страницу входа/регистрации
  if (authStore.isAuthenticated && (to.name === AppRouteNames.SignIn || to.name === AppRouteNames.SignUp)) {
    return next({ name: AppRouteNames.TripList })
  }

  next()
})

export default router
