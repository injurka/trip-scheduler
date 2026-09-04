import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import { GetTrackDayInputSchema, IngestBatchInputSchema, TrackActivityTypeSchema } from './tracking.schemas'
import { trackingService } from './tracking.service'

const SegmentOutputSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  activity: TrackActivityTypeSchema,
  confidence: z.number(),
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
  speed: z.number().nullable(),
  accuracy: z.number().nullable(),
  activity: TrackActivityTypeSchema,
  sessionId: z.string(),
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
      segments: z.array(SegmentOutputSchema),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        // Для неавторизованного просмотра данных нет — возвращаем пустой день
        return { points: [], segments: [] }
      }
      return trackingService.getDay(ctx.user.id, input)
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
      })).max(20_000),
    }))
    .output(z.object({ segments: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      return trackingService.reprocessDay(ctx.user.id, input.sessionId, input.points)
    }),
}
