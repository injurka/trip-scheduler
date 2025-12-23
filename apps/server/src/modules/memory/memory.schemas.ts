import { z } from 'zod'
import { TripImageSchema } from '../image/image.schemas'

export const MemorySchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  timestamp: z.union([z.string(), z.date()]).nullable(),
  comment: z.string().nullable(),
  imageId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).nullable(),
  sourceActivityId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  image: TripImageSchema.optional().nullable(),

  rating: z.number().min(1).max(5).nullable().optional(),
  tags: z.array(z.string()).default([]).nullable(),
})

export const CreateMemoryInputSchema = z.object({
  tripId: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  imageId: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),
  sourceActivityId: z.string().uuid().optional().nullable(),

  rating: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
})

export const UpdateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),

  rating: z.number().min(1).max(5).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export const DeleteMemoryInputSchema = z.object({
  id: z.string().uuid(),
})

export const GetMemoriesInputSchema = z.object({
  tripId: z.string().uuid(),
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
})
