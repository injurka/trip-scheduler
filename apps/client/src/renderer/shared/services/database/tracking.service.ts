import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

export const trackingService = {
  getDay: (dayUtc: string) => trpc.tracking.getDay.query({ dayUtc }),
  deletePoint: (clientPointId: string) => trpc.tracking.deletePoint.mutate({ clientPointId }),
  correctActivity: (input: { point?: boolean, sessionId: string, startedAt: number, endedAt: number, activity: ActivityType }) => trpc.tracking.correctActivity.mutate(input),
  removeCorrection: (id: string) => trpc.tracking.removeActivityCorrection.mutate({ id }),
}
