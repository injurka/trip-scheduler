import type { ImageMetadata } from '~/shared/types/models/trip'

export interface IImageViewerImageMeta extends ImageMetadata {
  latitude?: number | null
  longitude?: number | null
  takenAt?: string | null // ISO string
  width?: number | null
  height?: number | null
}

export interface ImageViewerImage {
  url: string
  alt?: string
  caption?: string
  meta?: IImageViewerImageMeta
  variants?: {
    small?: string
    medium?: string
    large?: string
  } | null
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

export type ImageQuality = 'medium' | 'large' | 'original'
