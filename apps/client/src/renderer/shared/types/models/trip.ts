import type { RouterInput, RouterOutput } from '../trpc'
import type { Day } from './activity'
import type { TripCityRef } from './geo-place'

// --- Типы, связанные с медиафайлами ---

export const TripMediaPlacement = {
  ROUTE: 'route',
  MEMORIES: 'memories',
  NOTES: 'notes',
  DOCUMENTS: 'documents',
} as const
export type TripMediaPlacement = typeof TripMediaPlacement[keyof typeof TripMediaPlacement]

export { TripMediaPlacement as TripImagePlacement }

export type ImageMetadata = NonNullable<RouterOutput['image']['getMetadata']>

/**
 * Основная модель медиа (изображения/видео) на фронтенде.
 */
export interface TripMedia {
  id: string
  tripId: string
  originalName: string
  name: string
  url: string
  mediaType?: 'image' | 'video'
  fileType: string
  placement: TripMediaPlacement
  createdAt: string // ISO string
  sizeBytes: number

  // --- Ключевые, часто запрашиваемые данные ---
  takenAt?: string | null // ISO string
  latitude?: number | null
  longitude?: number | null

  // --- Основные данные для отображения ---
  width?: number | null
  height?: number | null

  variants?: {
    small?: string
    medium?: string
    large?: string
    poster?: string
    web?: string
    thumbhash?: string
  } | Record<string, string> | null

  // --- Все остальные метаданные в одном поле JSONB ---
  metadata?: ImageMetadata | null
}

export type TripImage = TripMedia

export const TripStatus = {
  COMPLETED: 'completed',
  PLANNED: 'planned',
  DRAFT: 'draft',
} as const
export type TripStatus = typeof TripStatus[keyof typeof TripStatus]

export const TripVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const
export type TripVisibility = typeof TripVisibility[keyof typeof TripVisibility]

export const TripSectionType = {
  BOOKINGS: 'bookings',
  FINANCES: 'finances',
  CHECKLIST: 'checklist',
  NOTES: 'notes',
  DOCUMENTS: 'documents',
  MAP: 'map',
  CUSTOM: 'custom',
  MEMORIES: 'memories',
} as const
export type TripSectionType = typeof TripSectionType[keyof typeof TripSectionType]

export interface TripSection {
  id: string
  tripId: string
  type: TripSectionType
  title: string
  icon: string | null
  content?: unknown
  order: number
  createdAt: string
  updatedAt: string
}

export type SeasonalityLevel = 'low' | 'medium' | 'high' | 'peak'

export interface CityWeatherData {
  city: string
  tempAverage: number | null
  tempMin: number | null
  tempMax: number | null
  feelsLike?: number | null
  rainyDays?: number | null
  precipitationProbability?: number | null
  precipitationType?: string | null
  windSpeed?: number | null
  windDescription?: string | null
  seasonality?: SeasonalityLevel | null
  seasonalityDescription?: string | null
  daylight?: string | null
  daylightDescription?: string | null
  clothingRecommendation?: string | null
  summary?: string | null
  updatedAt: string
}

export type TripWeatherData = Record<string, CityWeatherData>

export interface TripWeatherPayload {
  weatherByPlaceId: TripWeatherData
}

export interface Trip {
  id: string
  userId: string
  shareSlug?: string | null
  title: string
  imageUrl: string | null
  description: string | null
  descriptionShort: string | null
  startDate: string
  endDate: string
  cityRefs?: TripCityRef[]
  status: TripStatus
  budget: number | null
  currency: string | null
  participants: {
    id: string
    name: string
    avatarUrl: string
  }[]
  tags: string[]
  weatherByPlaceId?: TripWeatherData | null
  visibility: TripVisibility
  createdAt: string
  updatedAt: string

  sections: TripSection[]
}

export interface TripWithDays extends Trip {
  days: Day[]
}

export interface Plan {
  id: number
  name: string
  maxTrips: number
  maxStorageBytes: number
  monthlyLlmCredits: number
  isDeveloping: boolean
}

export type CreateTripInput = RouterInput['trip']['create']
export type UpdateTripInput = RouterInput['trip']['update']['details']
