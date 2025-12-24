import type { PushSubscription as WebPushSubscription } from 'web-push'
import webpush from 'web-push'
import { createTRPCError } from '~/lib/trpc'
import { notificationRepository } from '~/repositories/notification.repository'
import { tripRepository } from '~/repositories/trip.repository'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@trip-scheduler.ru',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}
else {
  console.warn('VAPID keys are missing. Push notifications will not work.')
}

export const notificationService = {
  async checkTripSubscription(userId: string, tripId: string) {
    return await notificationRepository.hasTripSubscription(userId, tripId)
  },

  async subscribeToTrip(userId: string, tripId: string, subscription: WebPushSubscription) {
    const trip = await tripRepository.getById(tripId)
    if (!trip) {
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    }

    const isParticipant = trip.participants.some((p: any) => p.id === userId) || trip.userId === userId
    if (!isParticipant) {
      throw createTRPCError('FORBIDDEN', 'Вы должны быть участником путешествия')
    }

    await notificationRepository.upsertPushSubscription(userId, subscription)
    await notificationRepository.addTripSubscription(userId, tripId)
  },

  async unsubscribeFromTrip(userId: string, tripId: string) {
    await notificationRepository.removeTripSubscription(userId, tripId)
  },

  async sendMemoryUpdate(actorId: string, tripId: string, dayId: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      return

    const tokens = await notificationRepository.getSubscribersTokens(tripId, actorId)

    if (tokens.length === 0)
      return

    const payload = JSON.stringify({
      title: `Новые фото в "${trip.title}"`,
      body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
      icon: '/pwa-192x192.png',
      data: {
        url: `/trip/${tripId}?day=${dayId}&section=memories`,
      },
      tag: `trip-memory-${tripId}`,
    })

    const sendPromises = tokens.map(async (tokenRecord: { endpoint: string, keys: { p256dh: string, auth: string } }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: tokenRecord.endpoint,
            keys: tokenRecord.keys as { p256dh: string, auth: string },
          },
          payload,
        )
      }
      catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await notificationRepository.deletePushSubscription(tokenRecord.endpoint)
        }
        else {
          console.error('[Push Error]', error)
        }
      }
    })

    await Promise.allSettled(sendPromises)
  },
}
