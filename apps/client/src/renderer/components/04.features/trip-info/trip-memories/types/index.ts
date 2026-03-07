import type { Memory } from '~/shared/types/models/memory'

export interface IProcessingMemory {
  tempId: string
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'error' | 'success'
  progress: number
  error?: string
}

export interface TimelineGroup {
  type: 'start' | 'activity'
  title: string
  memories: Memory[]
  activity: Memory | null
}
