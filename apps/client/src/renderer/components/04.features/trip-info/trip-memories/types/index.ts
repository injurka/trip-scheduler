import type { Memory } from '~/shared/types/models/memory'
import type { TripImage } from '~/shared/types/models/trip'

export interface IProcessingMemory {
  tempId: string
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'error' | 'success'
  preparing?: boolean
  progress: number
  error?: string
  uploadedImage?: TripImage
}

export type ProcessingResizeItem = IProcessingMemory

export interface TimelineGroup {
  type: 'start' | 'activity'
  title: string
  memories: Memory[]
  activity: Memory | null
}
