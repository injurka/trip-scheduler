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
  PostCreate = 'post-create',
  PostDetails = 'post-details',

  BlogList = 'blog-list',
  BlogArticle = 'blog-article',
  BlogCreate = 'blog-create',
  BlogEdit = 'blog-edit',

  Explore = 'explore',

  ActivityMap = 'activity-map',
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
    List: '/post/list',
    Create: '/post/create',
    Details: (id: string) => `/post/${id}`,
    Edit: (id: string) => `/post/editor/${id}`,
  },

  Blog: {
    List: '/blog',
    Create: '/blog/create',
    Edit: (id: string) => `/blog/edit/${id}`,
    Article: (slug: string) => `/blog/${slug}`,
  },

  Explore: '/explore',

  ActivityMap: '/activity-map',
}
