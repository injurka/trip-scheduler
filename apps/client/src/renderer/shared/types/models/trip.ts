import type { RouterInput } from '../trpc'
import type { Day } from './activity'

// --- Типы, связанные с изображениями ---

export enum TripImagePlacement {
  ROUTE = 'route',
  MEMORIES = 'memories',
}

/**
 * Метаданные, относящиеся к GPS.
 */
interface GpsMetadata {
  altitude?: number // Высота над уровнем моря
  speed?: number // Скорость движения
  bearing?: number // Направление движения (курс)
  destBearing?: number // Направление на точку назначения
  gpsDate?: string // Дата и время по GPS
}

/**
 * Метаданные из IPTC блока (информация для прессы и описания).
 */
interface IptcMetadata {
  headline?: string // Заголовок
  caption?: string // Подробное описание/подпись
  keywords?: string[] // Ключевые слова
  city?: string // Город
  country?: string // Страна
}

/**
 * Всеобъемлющий интерфейс для поля metadata (JSONB).
 * Синхронизирован с бэкендом.
 */
export interface ImageMetadata {
  timezoneOffset?: number // Смещение временной зоны в минутах

  camera?: {
    make?: string // Производитель камеры
    model?: string // Модель камеры
    lens?: string // Модель объектива
    serialNumber?: string // Серийный номер камеры
  }

  settings?: {
    iso?: number // ISO
    aperture?: number // Диафрагма (FNumber)
    apertureValue?: number // Значение диафрагмы (APEX)
    shutterSpeed?: string // Выдержка в виде строки (например, "1/250s")
    exposureTime?: number // Выдержка в виде числа (в долях секунды)
    focalLength?: number // Фокусное расстояние
    focalLengthIn35mmFormat?: number // Фокусное расстояние в 35мм эквиваленте
    exposureMode?: number // Режим экспозиции
    whiteBalance?: number // Баланс белого
    meteringMode?: number // Режим замера экспозиции
    flash?: boolean // Была ли использована вспышка
  }

  technical?: {
    format?: string // Формат файла (jpeg, heic и т.д.)
    colorSpace?: string // Цветовое пространство (sRGB, Adobe RGB)
    orientation?: number // Ориентация изображения
    fileSize?: number // Размер файла в байтах
    resolutionX?: number // Разрешение по горизонтали (DPI)
    resolutionY?: number // Разрешение по вертикали (DPI)
    resolutionUnit?: string // Единица измерения разрешения (например, 'inches')
  }

  software?: {
    software?: string // Программа, в которой обработано фото
    creator?: string // Инструмент создателя
    copyright?: string // Информация об авторских правах
    modifyDate?: string | Date // Дата последнего изменения файла (ISO string или Date)
  }

  gps?: GpsMetadata
  iptc?: IptcMetadata

  // Поле для всех остальных данных, которые не были распарсены
  rawExif?: Record<string, any>
}

/**
 * Основная модель изображения на фронтенде.
 */
export interface TripImage {
  id: string
  tripId: string
  originalName: string
  url: string
  placement: TripImagePlacement
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
  } | null

  // --- Все остальные метаданные в одном поле JSONB ---
  metadata?: ImageMetadata | null
}

export enum TripStatus {
  COMPLETED = 'completed',
  PLANNED = 'planned',
  DRAFT = 'draft',
}

export enum TripVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum TripSectionType {
  BOOKINGS = 'bookings',
  FINANCES = 'finances',
  CHECKLIST = 'checklist',
  NOTES = 'notes',
  CUSTOM = 'custom',
  MAP = 'map',
}

export interface TripSection {
  id: string
  tripId: string
  type: TripSectionType
  title: string
  icon: string | null
  content: unknown
  order: number
  createdAt: string
  updatedAt: string
}

export interface Trip {
  id: string
  userId: string
  title: string
  imageUrl: string | null
  description: string | null
  startDate: string
  endDate: string
  cities: string[]
  status: TripStatus
  budget: number | null
  currency: string | null
  participants: {
    id: string
    name: string
    avatarUrl: string
  }[]
  tags: string[]
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
