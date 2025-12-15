import { z } from 'zod'

export const TripImageSchema = z.object({
  id: z.string(),

  url: z.string(),
  originalName: z.string(),
  sizeBytes: z.number().default(0),
  createdAt: z.date(),

  // Поля, которые могут отсутствовать при placement="route"
  tripId: z.string().optional(),
  placement: z.enum(['route', 'memories']).optional(),
  variants: z.any().nullable().optional(),
  takenAt: z.date().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  // Остальные поля оставляем как есть или тоже делаем опциональными по необходимости
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  metadata: z.any().nullable().optional(),
})

export const GetImagesByTripIdInputSchema = z.object({
  tripId: z.string().uuid(),
  placement: z.enum(['route', 'memories']).optional(),
})

export const DeleteImageInputSchema = z.object({
  id: z.string().uuid(),
})

export const GetImageMetadataInputSchema = z.object({
  id: z.string().uuid(),
})
