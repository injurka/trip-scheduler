import type { tripImagePlacementEnum } from 'db/schema'

type TripImagePlacement = (typeof tripImagePlacementEnum.enumValues)[number]

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

// --- Расширенные существующие интерфейсы ---

/**
 * Всеобъемлющий интерфейс для поля metadata (JSONB).
 */
interface ImageMetadata {
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

  rawExif?: Record<string, any>
}

/**
 * Основная модель изображения.
 */
export interface TripImage {
  id: string
  tripId: string
  url: string
  placement: TripImagePlacement
  createdAt: string // ISO string

  // --- Ключевые, часто запрашиваемые данные ---
  takenAt?: string | Date | null // Дата съемки (ISO string или Date)
  latitude?: number | null
  longitude?: number | null

  // --- Основные данные для отображения ---
  width?: number | null
  height?: number | null
  thumbnailUrl?: string | null

  // --- Все остальные метаданные в одном поле JSONB ---
  metadata?: ImageMetadata | null
}
