import type { RouterInput } from '../trpc'
import type { EActivityTag } from './activity'
import type { TripImage } from './trip'

export interface Memory {
  id: string
  title: string
  tripId: string
  timestamp: string | null
  comment: string | null
  imageId: string | null
  image: TripImage | null

  sourceActivityId: string
  tag?: EActivityTag

  createdAt: string
  updatedAt: string
}

/**
 * Тип данных для создания нового воспоминания.
 * Используется в API-запросах.
 */
export type CreateMemoryInput = RouterInput['memory']['create']

/**
 * Тип данных для обновления существующего воспоминания.
 * Используется в API-запросах.
 */
export type UpdateMemoryInput = RouterInput['memory']['update']
