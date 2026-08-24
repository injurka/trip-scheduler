export interface ImageMetadataCamera {
  make?: string
  model?: string
  lens?: string
  serialNumber?: string
}

export interface ImageMetadataSettings {
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
  flash?: boolean | number
}

export interface ImageMetadataTechnical {
  format?: string
  colorSpace?: string
  orientation?: number
  fileSize?: number
  resolutionX?: number
  resolutionY?: number
  resolutionUnit?: string
}

export interface ImageMetadataGps {
  altitude?: number
  speed?: number
  bearing?: number
  destBearing?: number
  gpsDate?: string
}

export interface ImageMetadataIptc {
  headline?: string
  caption?: string
  keywords?: string[]
  city?: string
  country?: string
}

export interface ImageMetadata {
  timezoneOffset?: number
  camera?: ImageMetadataCamera
  settings?: ImageMetadataSettings
  technical?: ImageMetadataTechnical
  gps?: ImageMetadataGps
  iptc?: ImageMetadataIptc
  rawExif?: Record<string, any>
  software?: {
    modifyDate?: string | Date
    software?: string
    creator?: string
    copyright?: string
    [key: string]: any
  }
  [key: string]: any
}

export interface IImageViewerImageMeta extends ImageMetadata {
  latitude?: number | null
  longitude?: number | null
  takenAt?: string | null
  width?: number | null
  height?: number | null
  [key: string]: any
}

export interface ImageViewerImageVariants {
  small?: string
  medium?: string
  large?: string
  [key: string]: string | undefined
}

export interface ImageViewerImage {
  url: string
  alt?: string
  caption?: string | null
  meta?: IImageViewerImageMeta
  variants?: ImageViewerImageVariants | null
}

export interface ImageViewerOptions {
  enableKeyboard?: boolean
  enableTouch?: boolean
  maxZoom?: number
  minZoom?: number
  zoomStep?: number
  animationDuration?: number
}

export interface ViewerTransform {
  scale: number
  x: number
  y: number
}

export interface ViewerBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface TouchPoint {
  x: number
  y: number
}

export type ImageQuality = 'small' | 'medium' | 'large' | 'original' | (string & {})

export interface KitViewerDropdownItem<T = any> {
  value: T
  label: string
  icon?: string
}

export interface ImageViewerMapMarker {
  id: string
  coords: {
    lon: number
    lat: number
  }
}
