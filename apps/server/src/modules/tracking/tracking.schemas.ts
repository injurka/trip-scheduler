import { z } from 'zod'

export const TrackActivityTypeSchema = z.enum(['still', 'walk', 'bike', 'vehicle', 'rail', 'unknown'])

export const TrackPointInputSchema = z.object({
  clientPointId: z.string().min(8).max(64),
  sessionId: z.string().min(4).max(64),
  tsUtc: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nonnegative().nullable().optional(),
  speed: z.number().nonnegative().nullable().optional(),
  bearing: z.number().min(0).max(360).nullable().optional(),
  activity: TrackActivityTypeSchema.default('unknown'),
  activityConfidence: z.number().int().min(0).max(100).default(0),
})

export const IngestBatchInputSchema = z.object({
  points: z.array(TrackPointInputSchema).min(1).max(2000),
})

export const GetTrackDayInputSchema = z.object({
  dayUtc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type TrackPointInput = z.infer<typeof TrackPointInputSchema>
export type IngestBatchInput = z.infer<typeof IngestBatchInputSchema>
export type GetTrackDayInput = z.infer<typeof GetTrackDayInputSchema>
