export enum AppRouteNames {
  Root = 'root',
  About = 'about',
  UsefulLinks = 'useful-links',
  Terms = 'terms',
  Privacy = 'privacy',
  OssLicenses = 'oss-licenses',

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

  PostList = 'post-list',

  BlogList = 'blog-list',
  BlogArticle = 'blog-article',
  BlogCreate = 'blog-create',
  BlogEdit = 'blog-edit',

  Explore = 'explore',
}

export const AppRoutePaths = {
  Root: '/',
  About: '/about',
  UsefulLinks: '/useful-links',
  Terms: '/terms',
  Privacy: '/privacy',
  OssLicenses: '/oss-licenses',

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

  Post: {
    List: '/posts',
  },

  Blog: {
    List: '/blog',
    Create: '/blog/create',
    Edit: (id: string) => `/blog/edit/${id}`,
    Article: (slug: string) => `/blog/${slug}`,
  },

  Explore: '/explore',
}
