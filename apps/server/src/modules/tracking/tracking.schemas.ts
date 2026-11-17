import { isTimeZone } from '@limiteddissolve/track-processing'
import { z } from 'zod'

export const TrackActivityTypeSchema = z.enum(['still', 'walk', 'bike', 'vehicle', 'rail', 'unknown'])

export const TrackPointInputSchema = z.object({
  samplingIntervalMs: z.number().int().min(1000).max(60000).optional(),
  clientPointId: z.string().min(8).max(64),
  sessionId: z.string().min(4).max(64),
  tsUtc: z.number().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  bearing: z.number().nullable().optional(),
  activity: TrackActivityTypeSchema.default('unknown'),
  activityConfidence: z.number().min(0).max(100).default(0),
  /** Сырой сигнал системного Activity Recognition: null — устройство его не сообщило. */
  deviceActivity: TrackActivityTypeSchema.nullable().optional(),
  deviceActivityConfidence: z.number().min(0).max(100).nullable().optional(),
})

export const IngestBatchInputSchema = z.object({
  ownerId: z.string().uuid().optional(),
  points: z.array(TrackPointInputSchema).min(1).max(2000),
})

export const TrackingTimeZoneSchema = z.string().max(100).refine(isTimeZone, 'Некорректный часовой пояс')

export const GetTrackDayInputSchema = z.object({
  dayUtc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: TrackingTimeZoneSchema.optional(),
})

export const DeleteTrackPointInputSchema = z.object({
  clientPointId: z.string().min(1).max(64),
})

export type TrackPointInput = z.infer<typeof TrackPointInputSchema>
export type IngestBatchInput = z.infer<typeof IngestBatchInputSchema>
export type GetTrackDayInput = z.infer<typeof GetTrackDayInputSchema>
export type DeleteTrackPointInput = z.infer<typeof DeleteTrackPointInputSchema>
