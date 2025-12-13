export type TripImagePlacement = 'route' | 'memories'

/**
 * Метаданные, относящиеся к GPS.
 */
interface GpsMetadata {
  altitude?: number
  speed?: number
  bearing?: number
  destBearing?: number
  gpsDate?: string
}

/**
 * Метаданные из IPTC блока.
 */
interface IptcMetadata {
  headline?: string
  caption?: string
  keywords?: string[]
  city?: string
  country?: string
}

/**
 * Всеобъемлющий интерфейс для поля metadata (JSONB).
 */
interface ImageMetadata {
  timezoneOffset?: number
  camera?: {
    make?: string
    model?: string
    lens?: string
    serialNumber?: string
  }
  settings?: {
    iso?: number
    aperture?: number
    apertureValue?: number
    shutterSpeed?: string
    exposureTime?: number
    focalLength?: number
    focalLengthIn35mmFormat?: number
    exposureMode?: number
    whiteBalance?: number
    meteringMode?: number
    flash?: boolean
  }
  technical?: {
    format?: string
    colorSpace?: string
    orientation?: number
    fileSize?: number
    resolutionX?: number
    resolutionY?: number
    resolutionUnit?: string
  }
  software?: {
    software?: string
    creator?: string
    copyright?: string
    modifyDate?: string | Date
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
  createdAt: string
  takenAt?: string | Date | null
  latitude?: number | null
  longitude?: number | null
  width?: number | null
  height?: number | null
  thumbnailUrl?: string | null
  metadata?: ImageMetadata | null
}
