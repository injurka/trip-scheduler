export enum AppRouteNames {
  Root = 'root',
  About = 'about',
  UsefulLinks = 'useful-links',

  NotFound = 'not-found',

  TripInfo = 'trip-info',
  TripList = 'trip-list',

  SignIn = 'sign-in',
  SignUp = 'sign-up',
  ForgotPassword = 'forgot-password',
  AuthCallback = 'auth-callback',

  UserProfile = 'user-profile',
  UserSettings = 'user-settings',
  UserQuota = 'user-quota',
  UserStorage = 'user-storage',

  Explore = 'explore',
}

export const AppRoutePaths = {
  Root: '/',
  About: '/about',
  UsefulLinks: '/useful-links',

  NotFound: '/:catchAll(.*)?',

  Trip: {
    List: `/trips`,
    Info: (id: string) => `/trip/${id}`,
  },

  Auth: {
    SignIn: '/auth/sign-in',
    SignUp: '/auth/sign-up',
    ForgotPassword: '/auth/forgot-password',
    Callback: '/auth/callback',
  },

  User: {
    Profile: (id: string) => `/user/${id}`,
    Settings: (id: string) => `/user/${id}/settings`,
    Quota: (id: string) => `/user/${id}/quota`,
    Storage: (id: string) => `/user/${id}/storage`,
  },

  Explore: '/explore',
}
