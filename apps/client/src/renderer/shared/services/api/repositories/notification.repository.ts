import type { INotificationRepository } from '../model/types'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class NotificationRepository implements INotificationRepository {
  async checkTripSubscription(tripId: string): Promise<boolean> {
    return await trpc.notification.checkTripSubscription.query({ tripId })
  }

  async subscribeToTrip(payload: { tripId: string, subscription: any }): Promise<void> {
    await trpc.notification.subscribeToTrip.mutate(payload)
  }

  async unsubscribeFromTrip(tripId: string): Promise<void> {
    await trpc.notification.unsubscribeFromTrip.mutate({ tripId })
  }

  async sendMemoryUpdate(payload: { tripId: string, dayId: string }): Promise<void> {
    await trpc.notification.sendMemoryUpdate.mutate(payload)
  }
}
