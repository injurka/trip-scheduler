import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

export const trackingService = {
  correctActivities: (input: import('~/shared/types/trpc').RouterInput['tracking']['correctActivities']) => trpc.tracking.correctActivities.mutate(input),
  getTripDay: (
    tripId: string,
    dayUtc: string,
    shareSlug?: string,
    timeZone?: string,
  ) => trpc.tracking.getTripDay.query({ tripId, dayUtc, shareSlug, timeZone }),
  getDay: (dayUtc: string, timeZone?: string) => trpc.tracking.getDay.query({ dayUtc, timeZone }),
  deletePoint: (clientPointId: string, tripId?: string, timeZone?: string) => trpc.tracking.deletePoint.mutate({ clientPointId, tripId, timeZone }),
  correctActivity: (input: { tripId?: string, timeZone?: string, point?: boolean, sessionId: string, startedAt: number, endedAt: number, activity: ActivityType }) => trpc.tracking.correctActivity.mutate(input),
  removeCorrection: (id: string, tripId?: string, timeZone?: string) => trpc.tracking.removeActivityCorrection.mutate({ id, tripId, timeZone }),
}
