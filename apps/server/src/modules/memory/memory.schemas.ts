import { z } from 'zod'
import { TripMediaSchema } from '../image/image.schemas'

export const MemorySchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  timestamp: z.union([z.string(), z.date()]).nullable(),
  comment: z.string().nullable(),
  imageId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  tag: z.enum(['activity', 'transport', 'walk', 'food', 'attraction', 'relax']).nullable(),
  sourceActivityId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  image: TripMediaSchema.optional().nullable(),

  rating: z.number().min(1).max(5).nullable().optional(),
  tags: z.array(z.string()).default([]).nullable(),
})

export const CreateMemoryInputSchema = z.object({
  tripId: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  imageId: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['activity', 'transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),
  sourceActivityId: z.string().uuid().optional().nullable(),

  rating: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
})

export const UpdateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime().optional().nullable(),
  comment: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tag: z.enum(['activity', 'transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),

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

// The same contract validates model output and the edited preview before saving.
export const MemoryProposalSchema = z.object({
  blocks: z.array(z.object({
    type: z.enum(['activity', 'note', 'description']),
    targetId: z.string().uuid().nullable(),
    title: z.string().trim().max(300),
    comment: z.string().trim().min(1).max(10000),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeEstimated: z.boolean(),
    tag: z.enum(['activity', 'transport', 'walk', 'food', 'attraction', 'relax']),
  }).superRefine((block, ctx) => {
    if (block.type === 'description' && !block.targetId)
      ctx.addIssue({ code: 'custom', message: 'Для описания нужен существующий блок.' })
    if (block.type !== 'description' && block.targetId)
      ctx.addIssue({ code: 'custom', message: 'Новый блок не должен иметь targetId.' })
    if (block.type === 'activity' && !block.title)
      ctx.addIssue({ code: 'custom', message: 'Укажите название активности.' })
  })).min(1).max(30),
})
export const GenerateMemoriesInputSchema = z.object({
  dayId: z.string().uuid(),
  text: z.string().trim().min(1).max(20000),
})
export const ApplyMemoriesInputSchema = MemoryProposalSchema.extend({ dayId: z.string().uuid() })
