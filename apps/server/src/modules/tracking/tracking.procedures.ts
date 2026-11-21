import { calendarDayBounds, trackGeometryActions } from '@limiteddissolve/track-processing'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { CorrectionBatchSchema, saveCorrectionBatch } from './correction-batch'
import { grantNativeTracking, revokeNativeTracking, syncNativeTracking } from './native-sync'
import { analyzeTrackQuality, TrackQualityAnalysisInput, TrackQualityAnalysisOutput } from './track-quality-analysis'
import { DeleteTrackPointInputSchema, GetTrackDayInputSchema, IngestBatchInputSchema, TrackActivityTypeSchema, TrackingTimeZoneSchema } from './tracking.schemas'
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
  samplingIntervalMs: z.number().nullable().optional(),
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
  geometryAction: z.enum(trackGeometryActions).nullable().optional(),
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

const GetTripTrackDayInput = GetTrackDayInputSchema.extend({ tripId: z.string().uuid(), shareSlug: z.string().optional() })

async function getTripDayAccess(
  input: z.infer<typeof GetTripTrackDayInput>,
  user: Parameters<typeof tripTrackAccess>[1],
  shareSlug?: string,
) {
  const access = await tripTrackAccess(input.tripId, user, input.shareSlug || shareSlug)
  const start = Date.parse(`${input.dayUtc}T00:00:00Z`)
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== input.dayUtc)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Некорректная дата' })

  const bounds = calendarDayBounds(input.dayUtc, access.timeZone)
  assertTripTrackRange(access, bounds.from.getTime(), bounds.to.getTime() - 1)
  return access
}

export const trackingProcedures = {
  grantNativeSync: protectedProcedure.input(z.object({ deviceId: z.string().uuid() })).output(z.object({ syncToken: z.string(), expiresAt: z.number() })).mutation(({ ctx, input }) => grantNativeTracking(ctx.user.id, input.deviceId)),
  revokeNativeSync: protectedProcedure.input(z.object({ deviceId: z.string().uuid() })).mutation(({ ctx, input }) => revokeNativeTracking(ctx.user.id, input.deviceId)),
  syncNative: publicProcedure.input(IngestBatchInputSchema.extend({ ownerId: z.string().uuid(), syncToken: z.string().min(64).max(200) })).output(z.object({ accepted: z.array(z.string()), rejectedCount: z.number().int() })).mutation(({ input }) => syncNativeTracking(input)),
  analyzeQualityIssue: protectedProcedure
    .input(TrackQualityAnalysisInput)
    .output(TrackQualityAnalysisOutput)
    .mutation(async ({ ctx, input }) => {
      const access = input.tripId ? await editableTripTrack(input.tripId, ctx.user) : null
      const timeZone = access?.timeZone ?? input.timeZone
      const bounds = calendarDayBounds(input.dayUtc, timeZone)
      if (access)
        assertTripTrackRange(access, bounds.from.getTime(), bounds.to.getTime() - 1)
      if (input.startedAt < bounds.from.getTime() || input.endedAt >= bounds.to.getTime())
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Участок относится к другому дню.' })
      return analyzeTrackQuality(ctx.user.id, access?.ownerId ?? ctx.user.id, { ...input, timeZone })
    }),
  correctActivities: protectedProcedure.input(CorrectionBatchSchema).output(z.object({ success: z.boolean() })).mutation(async ({ input, ctx }) => {
    if (!input.tripId)
      return saveCorrectionBatch(ctx.user.id, input)
    const access = await editableTripTrack(input.tripId, ctx.user)
    const bounds = calendarDayBounds(input.dayUtc, access.timeZone)
    assertTripTrackRange(access, bounds.from.getTime(), bounds.to.getTime() - 1)
    return saveCorrectionBatch(access.ownerId, { ...input, timeZone: access.timeZone })
  }),
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
        summary: 'Точки и сегменты календарного дня для «Воспоминаний дня»',
      },
    })
    .input(GetTrackDayInputSchema)
    .output(z.object({
      ownerId: z.string().optional(),
      timeZone: z.string().optional(),
      points: z.array(PointOutputSchema),
      rawPoints: z.array(PointOutputSchema).optional(),
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
    .input(GetTripTrackDayInput)
    .output(z.object({ ownerId: z.string().optional(), timeZone: z.string().optional(), points: z.array(PointOutputSchema), rawPoints: z.array(PointOutputSchema).optional(), corrections: z.array(CorrectionOutputSchema), segments: z.array(SegmentOutputSchema), canEdit: z.boolean() }))
    .query(async ({ input, ctx }) => {
      const access = await getTripDayAccess(input, ctx.user, ctx.c?.req.header('x-share-slug'))
      const data = await trackingService.getDay(access.ownerId, { ...input, timeZone: access.timeZone })
      // History is editable metadata; public viewers only need effective points and segments.
      return { ...data, corrections: access.canEdit ? data.corrections : [], canEdit: access.canEdit }
    }),

  getTripDaySummary: publicProcedure
    .input(GetTripTrackDayInput)
    .output(z.object({ summary: DaySummarySchema, timeZone: z.string() }))
    .query(async ({ input, ctx }) => {
      const access = await getTripDayAccess(input, ctx.user, ctx.c?.req.header('x-share-slug'))
      return trackingService.getDaySummary(access.ownerId, { ...input, timeZone: access.timeZone })
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
      timeZone: TrackingTimeZoneSchema.optional(),
      days: z.number().int().min(1).max(90).default(14),
    }))
    .output(z.object({
      summaries: z.array(DaySummarySchema),
    }))
    .query(async ({ input, ctx }) => {
      const summaries = await trackingService.getSummaries(ctx.user.id, input.days, input.timeZone)
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
      timeZone: TrackingTimeZoneSchema.optional(),
    }).refine(input => (input.endedAt > input.startedAt || (input.point === true && input.endedAt === input.startedAt)) && input.endedAt - input.startedAt <= 24 * 3600_000, { message: 'Выберите интервал длительностью до 24 часов' }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.tripId)
        return trackingService.correctActivity(ctx.user.id, input)
      const access = await editableTripTrack(input.tripId, ctx.user)
      assertTripTrackRange(access, input.startedAt, input.endedAt, access.timeZone)
      return trackingService.correctActivity(access.ownerId, input)
    }),

  removeActivityCorrection: protectedProcedure
    .input(z.object({ id: z.string().uuid(), tripId: z.string().uuid().optional(), timeZone: TrackingTimeZoneSchema.optional() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.tripId)
        return trackingService.removeActivityCorrection(ctx.user.id, input.id)
      const access = await editableTripTrack(input.tripId, ctx.user)
      const [correction] = await db.select().from(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, access.ownerId), eq(trackActivityCorrections.id, input.id))).limit(1)
      if (!correction)
        throw new TRPCError({ code: 'NOT_FOUND' })
      assertTripTrackRange(access, correction.startedAt.getTime(), correction.endedAt.getTime(), access.timeZone)
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
    .input(DeleteTrackPointInputSchema.extend({ tripId: z.string().uuid().optional(), timeZone: TrackingTimeZoneSchema.optional() }))
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
      assertTripTrackRange(access, point.tsUtc.getTime(), point.tsUtc.getTime(), access.timeZone)
      return trackingService.deletePoint(access.ownerId, input.clientPointId)
    }),
}
