import type { Activity, Day } from '~/shared/types/models/activity'
import type { SignInPayload, SignUpPayload, TelegramAuthPayload, TokenPair, User } from '~/shared/types/models/auth'
import type { BlogListItems, BlogPost, CreateBlogPostInput, UpdateBlogPostInput } from '~/shared/types/models/blog'
import type { Comment, CreateCommentInput, UpdateCommentInput } from '~/shared/types/models/comment'
import type {
  CreateMarkInput,
  GetMarksParams,
  Mark,
} from '~/shared/types/models/mark'
import type { CreateMemoryInput, Memory, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { Place, PlaceTag } from '~/shared/types/models/place'
import type {
  CreatePostInput,
  ListPostsFilters,
  PostDetail,
  UpdatePostInput,
} from '~/shared/types/models/post'
import type {
  CreateTripInput,
  ImageMetadata,
  Plan,
  Trip,
  TripImage,
  TripImagePlacement,
  TripSection,
  TripSectionType,
  TripStatus,
  TripWithDays,
  UpdateTripInput,
} from '~/shared/types/models/trip'

export interface IPostRepository {
  list: (filters: ListPostsFilters) => Promise<{ items: PostDetail[], nextCursor?: string }>
  getById: (params: { id: string }) => Promise<PostDetail>
  create: (data: CreatePostInput) => Promise<PostDetail>
  update: (params: { id: string, data: Partial<UpdatePostInput> }) => Promise<PostDetail>
  delete: (params: { id: string }) => Promise<{ id: string }>
  toggleSave: (params: { postId: string }) => Promise<{ isSaved: boolean }>
  toggleLike: (params: { postId: string }) => Promise<{ isLiked: boolean }>
}

export interface INotificationRepository {
  checkTripSubscription: (tripId: string) => Promise<boolean>
  subscribeToTrip: (payload: { tripId: string, subscription: any }) => Promise<void>
  unsubscribeFromTrip: (tripId: string) => Promise<void>
  sendMemoryUpdate: (payload: { tripId: string, dayId: string }) => Promise<void>
}

export interface IMarksRepository {
  getMarks: (params: GetMarksParams) => Promise<Mark[]>
  createMark: (data: CreateMarkInput) => Promise<Mark>
}

export interface IPlacesRepository {
  getPlacesByCity: (city: string, filters?: { tags?: string[] }) => Promise<Place[]>
  getAvailableTags: (city: string) => Promise<PlaceTag[]>
}
export interface TripListFilters {
  search?: string
  statuses?: TripStatus[]
  tags?: string[]
  cities?: string[]
  userIds?: string[]
}

export interface GeneratedBooking {
  type: 'flight' | 'hotel' | 'train' | 'attraction'
  title: string
  data: any
}

export interface GeneratedTransaction {
  title: string
  amount: number
  currency: string
  categorySuggestion?: string
  date?: string
  notes?: string
}

export interface ILLMRepository {
  generateBookingFromData: (formData: FormData) => Promise<GeneratedBooking>
  generateFinancesFromData: (formData: FormData) => Promise<GeneratedTransaction[]>
}

export interface ITripRepository {
  getAll: (filters?: TripListFilters) => Promise<Trip[]>
  getById: (id: string) => Promise<Trip | null>
  getByIdWithDays: (id: string) => Promise<TripWithDays | null>
  create: (data: CreateTripInput) => Promise<Trip>
  update: (id: string, details: UpdateTripInput) => Promise<Trip>
  delete: (id: string) => Promise<Trip>
  getUniqueCities: () => Promise<string[]>
  getUniqueTags: (params: { query?: string }) => Promise<string[]>
  listByUser: (params: { userId: string, limit: number }) => Promise<Trip[]>
  addParticipant: (tripId: string, email: string) => Promise<void>
}

export interface IDayRepository {
  getByTripId: (tripId: string) => Promise<Day[]>
  createNewDay: (dayData: Omit<Day, 'id' | 'activities'>) => Promise<Day>
  updateDayDetails: (id: string, details: Partial<Pick<Day, 'title' | 'description' | 'date' | 'meta' | 'note'>>) => Promise<Day>
  deleteDay: (id: string) => Promise<Day>
  getNote: (params: { dayId: string }) => Promise<string | null>
}

export interface IActivityRepository {
  create: (activityData: Omit<Activity, 'id'>) => Promise<Activity>
  update: (activityData: Activity) => Promise<Activity>
  remove: (id: string) => Promise<Activity>
}

export type EntityType = 'trip' | 'post' | 'blog' | 'avatar'

export interface IFileRepository {
  uploadFile: (
    file: File,
    entityId: string,
    entityType: EntityType,
    placement?: string | null,
    timestamp?: string | null,
    comment?: string | null,
  ) => Promise<TripImage>

  uploadFileWithProgress: (
    file: File,
    entityId: string,
    entityType: EntityType,
    placement: string | null,
    onProgress: (percentage: number) => void,
    signal: AbortSignal,
  ) => Promise<TripImage>

  listImages: (entityId: string, entityType: EntityType, placement?: string) => Promise<TripImage[]>
  listImageByTrip: (tripId: string, placement: TripImagePlacement) => Promise<TripImage[]>

  getAllUserFiles: () => Promise<TripImage[]>
  deleteFile: (id: string) => Promise<void>
  getMetadata: (id: string) => Promise<ImageMetadata | null>
}

export interface IAuthRepository {
  verifyEmail: (payload: { email: string, token: string }) => Promise<{ user: User, token: TokenPair }>
  signInWithTelegram: (authData: TelegramAuthPayload) => Promise<{ user: User, token: TokenPair }>
  signIn: (payload: SignInPayload) => Promise<{ user: User, token: TokenPair }>
  signOut: () => Promise<void>
  signUp: (payload: SignUpPayload) => Promise<{ success: boolean, message?: string }>
  refresh: (refreshToken: string) => Promise<{ token: TokenPair }>
  me: () => Promise<User>
  updateStatus: (data: { statusText?: string | null, statusEmoji?: string | null }) => Promise<User>
  updateUser: (data: { name?: string, avatarUrl?: string }) => Promise<User>
  uploadAvatar: (file: File) => Promise<User>
}

export interface IUserRepository {
  getById: (id: string) => Promise<User>
  listPlans: () => Promise<Plan[]>
}

export interface ITripSectionRepository {
  create: (data: { tripId: string, type: TripSectionType, title: string, icon: string | null, content: any }) => Promise<TripSection>
  update: (data: { id: string, title?: string | undefined, icon?: string | null | undefined, content?: any }) => Promise<TripSection>
  delete: (id: string) => Promise<TripSection>
}

export interface ICommentRepository {
  list: (params: { parentId: string, page: number, limit: number }) => Promise<{ data: Comment[], total: number }>
  create: (data: CreateCommentInput) => Promise<Comment>
  update: (data: UpdateCommentInput) => Promise<Comment>
  delete: (params: { commentId: string }) => Promise<Comment>
}

export interface IBlogRepository {
  list: (limit: number, cursor?: string) => Promise<{ items: BlogListItems[], nextCursor?: string }>
  getBySlug: (slug: string) => Promise<BlogPost>
  getById: (id: string) => Promise<BlogPost>
  create: (data: CreateBlogPostInput) => Promise<BlogPost>
  update: (data: UpdateBlogPostInput) => Promise<BlogPost>
  delete: (id: string) => Promise<void>
}

export interface IMemoryRepository {
  getByTripId: (tripId: string) => Promise<Memory[]>
  create: (data: CreateMemoryInput) => Promise<Memory>
  update: (data: UpdateMemoryInput) => Promise<Memory>
  delete: (id: string) => Promise<Memory>
  applyTakenAtTimestamp: (id: string) => Promise<Memory>
  unassignTimestamp: (id: string) => Promise<Memory>
}

export enum DatabaseMode {
  REAL = 'real',
  MOCK = 'mock',
}

export interface IDatabaseClient {
  trips: ITripRepository
  days: IDayRepository
  files: IFileRepository
  activities: IActivityRepository
  memories: IMemoryRepository
  auth: IAuthRepository
  user: IUserRepository
  tripSections: ITripSectionRepository
  comments: ICommentRepository
  llm: ILLMRepository
  places: IPlacesRepository
  blog: IBlogRepository
  marks: IMarksRepository
  notification: INotificationRepository
  posts: IPostRepository
}
