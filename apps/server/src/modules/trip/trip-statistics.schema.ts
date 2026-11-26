import { trackActivities } from '@limiteddissolve/track-processing'
import { z } from 'zod'

const speedActivity = z.enum(trackActivities).exclude(['still', 'unknown'])
const activitySpeed = z.object({
  medianKmh: z.number().positive(),
  p25Kmh: z.number().positive(),
  p75Kmh: z.number().positive(),
})

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
  distanceM: z.object({
    walk: z.number(),
    bike: z.number(),
    vehicle: z.number(),
    rail: z.number(),
    metro: z.number().default(0),
    ship: z.number().default(0),
    plane: z.number().default(0),
    cable_car: z.number().default(0),
    moto: z.number().default(0),
    bus: z.number().default(0),
    unknown: z.number(),
  }),
  speedByActivity: z.partialRecord(speedActivity, activitySpeed).optional(),
  movingDurationMs: z.number(),
  longestDay: z.object({ date: z.string(), distanceM: z.number() }).nullable(),
})

export type TripStatistics = z.infer<typeof TripStatisticsSchema>
