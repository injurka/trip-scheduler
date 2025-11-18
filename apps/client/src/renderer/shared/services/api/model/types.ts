import type { Activity, Day } from '~/shared/types/models/activity'
import type { SignInPayload, SignUpPayload, TelegramAuthPayload, TokenPair, User } from '~/shared/types/models/auth'
import type { CreateCommentInput, UpdateCommentInput } from '~/shared/types/models/comment'
import type { Community, CreateCommunityInput, ListCommunitiesInput } from '~/shared/types/models/community'
import type { CreateMemoryInput, Memory, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { Place, PlaceTag } from '~/shared/types/models/place'
import type { CreateTripInput, Plan, Trip, TripImage, TripImagePlacement, TripSection, TripSectionType, TripStatus, TripWithDays, UpdateTripInput } from '~/shared/types/models/trip'

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

/**
 * Структура объекта бронирования, возвращаемая сервисом генерации ИИ.
 */
export interface GeneratedBooking {
  type: 'flight' | 'hotel' | 'train' | 'attraction'
  title: string
  data: any // Структура данных зависит от типа
}

/**
 * Структура объекта транзакции, возвращаемая сервисом генерации ИИ.
 */
export interface GeneratedTransaction {
  title: string
  amount: number
  currency: string
  categorySuggestion?: string
  date?: string // YYYY-MM-DD
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
}

export interface IDayRepository {
  getByTripId: (tripId: string) => Promise<Day[]>
  createNewDay: (dayData: Omit<Day, 'id' | 'activities'>) => Promise<Day>
  updateDayDetails: (id: string, details: Partial<Pick<Day, 'title' | 'description' | 'date'>>) => Promise<Day>
  deleteDay: (id: string) => Promise<Day>
}

export interface IActivityRepository {
  create: (activityData: Omit<Activity, 'id'>) => Promise<Activity>
  update: (activityData: Activity) => Promise<Activity>
  remove: (id: string) => Promise<Activity>
}

export interface IFileRepository {
  uploadFile: (file: File, tripId: string, placement: TripImagePlacement, timestamp?: string | null, comment?: string | null) => Promise<TripImage>
  uploadFileWithProgress: (file: File, tripId: string, placement: TripImagePlacement, onProgress: (percentage: number) => void, signal: AbortSignal) => Promise<TripImage>
  listImageByTrip: (tripId: string, placement: TripImagePlacement) => Promise<TripImage[]>
  getAllUserFiles: () => Promise<TripImage[]>
  deleteFile: (id: string) => Promise<void>
}

export interface IAuthRepository {
  signUp: (payload: SignUpPayload) => Promise<{ success: boolean, message: string }>
  verifyEmail: (payload: { email: string, token: string }) => Promise<{ user: User, token: TokenPair }>
  signInWithTelegram: (authData: TelegramAuthPayload) => Promise<{ user: User, token: TokenPair }>
  signIn: (payload: SignInPayload) => Promise<{ user: User, token: TokenPair }>
  signOut: () => Promise<void>
  refresh: (refreshToken: string) => Promise<{ token: TokenPair }>
  me: () => Promise<User>
  updateStatus: (data: { statusText?: string | null, statusEmoji?: string | null }) => Promise<User>
  updateUser: (data: { name?: string, avatarUrl?: string }) => Promise<User>
  uploadAvatar: (file: File) => Promise<User>
}

export interface ITripSectionRepository {
  create: (data: { tripId: string, type: TripSectionType, title: string, icon: string | null, content: any }) => Promise<TripSection>
  update: (data: { id: string, title?: string, icon?: string | null, content?: any }) => Promise<TripSection>
  delete: (id: string) => Promise<TripSection>
}

export interface ICommentRepository {
  list: (params: { parentId: string, page: number, limit: number }) => Promise<{ data: Comment[], total: number }>
  create: (data: CreateCommentInput) => Promise<Comment>
  update: (data: UpdateCommentInput) => Promise<Comment>
  delete: (params: { commentId: string }) => Promise<Comment>
}

export interface IAccountRepository {
  listPlans: () => Promise<Plan[]>
}

export interface ICommunityRepository {
  create: (data: CreateCommunityInput, ownerId: string) => Promise<Community>
  list: (filters: ListCommunitiesInput) => Promise<Community[]>
  getById: (id: string) => Promise<Community | null>
}

// Интерфейс для всей базы данных
export interface IDatabaseClient {
  trips: ITripRepository
  days: IDayRepository
  files: IFileRepository
  activities: IActivityRepository
  memories: IMemoryRepository
  auth: IAuthRepository
  tripSections: ITripSectionRepository
  comments: ICommentRepository
  account: IAccountRepository
  community: ICommunityRepository
  llm: ILLMRepository
  places: IPlacesRepository
}

export interface IMemoryRepository {
  getByTripId: (tripId: string) => Promise<Memory[]>
  create: (data: CreateMemoryInput) => Promise<Memory>
  update: (data: UpdateMemoryInput) => Promise<Memory>
  delete: (id: string) => Promise<Memory>
  applyTakenAtTimestamp: (id: string) => Promise<Memory>
  unassignTimestamp: (id: string) => Promise<Memory>
}

// Режимы работы
export enum DatabaseMode {
  REAL = 'real',
  MOCK = 'mock',
}
