import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { countries, destinationReviews } from '~/../db/schema'

// --- Output Schemas ---
export const CountrySchema = createSelectSchema(countries)

const BaseDestinationReviewSchema = createSelectSchema(destinationReviews)

export const DestinationReviewSchema = BaseDestinationReviewSchema.extend({
  country: CountrySchema.optional().nullable(),

  metrics: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return {} }
      }
      return val
    },
    z.record(z.string(), z.number())
  ),

  createdAt: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date()),
  updatedAt: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date()),
})

// --- Input Schemas ---
export const GetUserReviewsInputSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['country', 'city']).optional(),
})

export const CreateReviewInputSchema = z.object({
  type: z.enum(['country', 'city']),
  countryId: z.string(),
  city: z.string().nullable(),
  coverUrl: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  content: z.string().nullable(),
  metrics: z.record(z.string(), z.number()),
})

export const DeleteReviewInputSchema = z.object({
  id: z.string().uuid(),
})
