import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { DeleteTrackPointInputSchema, GetTrackDayInputSchema, IngestBatchInputSchema, TrackActivityTypeSchema } from './tracking.schemas'
import { trackingService } from './tracking.service'
import { assertTripTrackRange, editableTripTrack, tripTrackAccess } from './trip-track-access'

const SegmentOutputSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  activity: TrackActivityTypeSchema,
  confidence: z.number(),
  activitySource: z.enum(['automatic', 'manual']).default('automatic'),
  simplifiedPoints: z.array(z.object({ tsUtc: z.number(), lat: z.number(), lng: z.number() })),
  startedAt: z.number(),
  endedAt: z.number(),
  distanceM: z.number(),
  pointCount: z.number(),
  geometry: z.array(z.tuple([z.number(), z.number()])),
})

const PointOutputSchema = z.object({
  clientPointId: z.string(),
  tsUtc: z.number(),
  lat: z.number(),
  lng: z.number(),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable(),
  speed: z.number().nullable(),
  bearing: z.number().nullable().optional(),
  activity: TrackActivityTypeSchema,
  sessionId: z.string(),
  recordedActivity: TrackActivityTypeSchema,
  activityConfidence: z.number(),
  activitySource: z.enum(['automatic', 'manual']),
  deviceActivity: TrackActivityTypeSchema.nullable(),
  deviceActivityConfidence: z.number().nullable(),
})

const CorrectionOutputSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  activity: TrackActivityTypeSchema,
  createdAt: z.number(),
})

const ActivitySummarySchema = z.object({
  activity: TrackActivityTypeSchema,
  distanceM: z.number(),
  durationMs: z.number(),
  segmentCount: z.number().int(),
})

const DaySummarySchema = z.object({
  dayUtc: z.string(),
  totalDistanceM: z.number(),
  totalDurationMs: z.number(),
  byActivity: z.array(ActivitySummarySchema),
  firstPointTs: z.number().nullable(),
  lastPointTs: z.number().nullable(),
  hasData: z.boolean(),
})

export const trackingProcedures = {
  ingestBatch: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tracking/ingest-batch',
        tags: ['Tracking'],
        summary: 'Идемпотентная выгрузка батча GPS-точек с мобильного клиента',
      },
    })
    .input(IngestBatchInputSchema)
    .output(z.object({
      accepted: z.array(z.string()),
      rejectedCount: z.number().int(),
    }))
    .mutation(async ({ input, ctx }) => {
      return trackingService.ingestBatch(ctx.user.id, input)
    }),

  getDay: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/tracking/day/{dayUtc}',
        tags: ['Tracking'],
        summary: 'Точки и сегменты дня (UTC) для «Воспоминаний дня»',
      },
    })
    .input(GetTrackDayInputSchema)
    .output(z.object({
      points: z.array(PointOutputSchema),
      corrections: z.array(CorrectionOutputSchema),
      segments: z.array(SegmentOutputSchema),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        // Для неавторизованного просмотра данных нет — возвращаем пустой день
        return { points: [], segments: [], corrections: [] }
      }
      return trackingService.getDay(ctx.user.id, input)
    }),

  getTripDay: publicProcedure
    .input(GetTrackDayInputSchema.extend({ tripId: z.string().uuid(), shareSlug: z.string().optional() }))
    .output(z.object({ points: z.array(PointOutputSchema), corrections: z.array(CorrectionOutputSchema), segments: z.array(SegmentOutputSchema), canEdit: z.boolean() }))
    .query(async ({ input, ctx }) => {
      const access = await tripTrackAccess(input.tripId, ctx.user, input.shareSlug || ctx.c?.req.header('x-share-slug'))
      const start = Date.parse(`${input.dayUtc}T00:00:00Z`)
      if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== input.dayUtc)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Некорректная дата' })
      assertTripTrackRange(access, start, start + 86400000 - 1)
      const data = await trackingService.getDay(access.ownerId, input)
      // History is editable metadata; public viewers only need effective points and segments.
      return { ...data, corrections: access.canEdit ? data.corrections : [], canEdit: access.canEdit }
    }),

  /** Сводки за последние N дней (по умолчанию 14) для страницы «Активность». */
  getSummaries: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/tracking/summaries',
        tags: ['Tracking'],
        summary: 'Сводки подвижности по дням (расстояние и время по видам активности)',
      },
    })
    .input(z.object({
      days: z.number().int().min(1).max(90).default(14),
    }))
    .output(z.object({
      summaries: z.array(DaySummarySchema),
    }))
    .query(async ({ input, ctx }) => {
      const summaries = await trackingService.getSummaries(ctx.user.id, input.days)
      return { summaries }
    }),

  reprocessDay: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tracking/reprocess-day',
        tags: ['Tracking'],
        summary: 'Пост-обработка сырых точек дня в классифицированные сегменты',
      },
    })
    .input(z.object({
      sessionId: z.string().min(4).max(64),
      points: z.array(z.object({
        tsUtc: z.number().int().positive(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speed: z.number().nullable(),
        activity: TrackActivityTypeSchema,
        // Погрешность и сигнал Activity Recognition: без них день на сервере
        // классифицируется иначе, чем живой трек на устройстве.
        accuracy: z.number().nullable().default(null),
        deviceActivity: TrackActivityTypeSchema.nullable().default(null),
        deviceActivityConfidence: z.number().min(0).max(100).nullable().default(null),
      })).max(20_000),
    }))
    .output(z.object({ segments: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      return trackingService.reprocessDay(ctx.user.id, input.sessionId, input.points)
    }),

  correctActivity: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(4).max(64),
      startedAt: z.number().int().positive().max(8_640_000_000_000_000),
      endedAt: z.number().int().positive().max(8_640_000_000_000_000),
      activity: TrackActivityTypeSchema,
      point: z.boolean().optional(),
      tripId: z.string().uuid().optional(),
    }).refine(input => (input.endedAt > input.startedAt || (input.point === true && input.endedAt === input.startedAt)) && input.endedAt - input.startedAt <= 24 * 3600_000, { message: 'Выберите интервал длительностью до 24 часов' }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.tripId)
        return trackingService.correctActivity(ctx.user.id, input)
      const access = await editableTripTrack(input.tripId, ctx.user)
      assertTripTrackRange(access, input.startedAt, input.endedAt)
      return trackingService.correctActivity(access.ownerId, input)
    }),

  removeActivityCorrection: protectedProcedure
    .input(z.object({ id: z.string().uuid(), tripId: z.string().uuid().optional() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.tripId)
        return trackingService.removeActivityCorrection(ctx.user.id, input.id)
      const access = await editableTripTrack(input.tripId, ctx.user)
      const [correction] = await db.select().from(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, access.ownerId), eq(trackActivityCorrections.id, input.id))).limit(1)
      if (!correction)
        throw new TRPCError({ code: 'NOT_FOUND' })
      assertTripTrackRange(access, correction.startedAt.getTime(), correction.endedAt.getTime())
      return trackingService.removeActivityCorrection(access.ownerId, input.id)
    }),

  deletePoint: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/tracking/delete-point',
        tags: ['Tracking'],
        summary: 'Удаление ошибочной GPS-точки и нормализация маршрута',
      },
    })
    .input(DeleteTrackPointInputSchema.extend({ tripId: z.string().uuid().optional() }))
    .output(z.object({
      success: z.boolean(),
      clientPointId: z.string(),
      reprocessedSegments: z.number().int(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!input.tripId)
        return trackingService.deletePoint(ctx.user.id, input.clientPointId)
      const access = await editableTripTrack(input.tripId, ctx.user)
      const [point] = await db.select().from(trackPoints).where(and(eq(trackPoints.userId, access.ownerId), eq(trackPoints.clientPointId, input.clientPointId))).limit(1)
      if (!point)
        throw new TRPCError({ code: 'NOT_FOUND' })
      assertTripTrackRange(access, point.tsUtc.getTime())
      return trackingService.deletePoint(access.ownerId, input.clientPointId)
    }),
}
