import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { countries, destinationReviews } from '~/../db/schema'

// --- Output Schemas ---
export const CountrySchema = createSelectSchema(countries)

const BaseDestinationReviewSchema = createSelectSchema(destinationReviews)

// Строгая схема для метрик (только числа или строки-комментарии)
const MetricsRecordSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.null()]),
)

export const DestinationReviewSchema = BaseDestinationReviewSchema.extend({
  country: CountrySchema.optional().nullable(),

  metrics: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val)
        }
        catch {
          return {}
        }
      }
      return val
    },
    MetricsRecordSchema,
  ),

  createdAt: z.preprocess(val => (typeof val === 'string' ? new Date(val) : val), z.date()),
  updatedAt: z.preprocess(val => (typeof val === 'string' ? new Date(val) : val), z.date()),
})

// --- Input Schemas ---
export const GetUserReviewsInputSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['country', 'city']).optional(),
  limit: z.number().min(1).max(100).default(24),
  page: z.number().min(1).default(1),
  countryId: z.string().optional(),
  city: z.string().optional(),
  sortBy: z.enum([
    'createdAt',
    'rating',
    'safety',
    'culture',
    'infrastructure',
    'food',
    'prices',
    'nature',
    'vibe',
    'climate',
    'people',
    'entertainment',
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const CreateReviewInputSchema = z.object({
  type: z.enum(['country', 'city']),
  countryId: z.string(),
  city: z.string().nullable(),
  coverUrl: z.string().nullable(),
  coverVariants: z.record(z.string(), z.string()).optional().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  content: z.string().nullable(),
  metrics: MetricsRecordSchema,
})

export const UpdateReviewInputSchema = CreateReviewInputSchema.partial().extend({
  id: z.string().uuid(),
})

export const DeleteReviewInputSchema = z.object({
  id: z.string().uuid(),
})
