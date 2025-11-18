import { z } from 'zod'

export const MemorySchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  timestamp: z.string().datetime().nullable(),
  comment: z.string().nullable(),
  imageId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).nullable(),
  sourceActivityId: z.string().uuid().nullable(),
  imageUrl: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const CreateMemoryInputSchema = z.object({
  tripId: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  imageId: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),
  sourceActivityId: z.string().uuid().optional().nullable(),
})

export const UpdateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),
})

export const DeleteMemoryInputSchema = z.object({
  id: z.string().uuid(),
})
