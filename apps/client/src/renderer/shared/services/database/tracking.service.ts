import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

export const trackingService = {
  correctActivities: (input: import('~/shared/types/trpc').RouterInput['tracking']['correctActivities']) => trpc.tracking.correctActivities.mutate(input),
  getTripDay: (tripId: string, dayUtc: string, shareSlug?: string) => trpc.tracking.getTripDay.query({ tripId, dayUtc, shareSlug }),
  getDay: (dayUtc: string) => trpc.tracking.getDay.query({ dayUtc }),
  deletePoint: (clientPointId: string, tripId?: string) => trpc.tracking.deletePoint.mutate({ clientPointId, tripId }),
  correctActivity: (input: { tripId?: string, point?: boolean, sessionId: string, startedAt: number, endedAt: number, activity: ActivityType }) => trpc.tracking.correctActivity.mutate(input),
  removeCorrection: (id: string, tripId?: string) => trpc.tracking.removeActivityCorrection.mutate({ id, tripId }),
}
