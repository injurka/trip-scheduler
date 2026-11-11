import { z } from 'zod'

export const TripStatisticsSchema = z.object({
  version: z.literal(1),
  computedAt: z.string().datetime(),
  startDate: z.string(),
  endDate: z.string(),
  photos: z.number(),
  videos: z.number(),
  favoritePhotos: z.number(),
  textMemories: z.number(),
  notes: z.number(),
  documents: z.number(),
  plannedActivities: z.number(),
  plannedPlaces: z.number(),
  trackedDays: z.number(),
  distanceM: z.record(z.enum(['walk', 'bike', 'vehicle', 'rail', 'unknown']), z.number()),
  movingDurationMs: z.number(),
  longestDay: z.object({ date: z.string(), distanceM: z.number() }).nullable(),
})

export type TripStatistics = z.infer<typeof TripStatisticsSchema>
