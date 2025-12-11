import { z } from 'zod'

export const TripImageSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  url: z.string(),
  originalName: z.string(),
  placement: z.enum(['route', 'memories']),
  sizeBytes: z.number().default(0),
  createdAt: z.date(),
  takenAt: z.date().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  variants: z.any().nullable().optional(), // JSONB
  metadata: z.any().nullable().optional(), // JSONB
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
