import type { PushSubscription as WebPushSubscription } from 'web-push'
import webpush from 'web-push'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { notificationRepository } from '~/repositories/notification.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { hasFcmServiceAccountConfigured, sendFcmMessage } from './fcm'

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

    await notificationRepository.upsertPushSubscription(userId, subscription)
    await notificationRepository.addTripSubscription(userId, tripId)
  },

  async subscribeToTripWithPushToken(userId: string, tripId: string, token: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip) {
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    }

    await notificationRepository.upsertPushToken(userId, token, 'fcm')
    await notificationRepository.addTripSubscription(userId, tripId)
  },

  async registerPushToken(userId: string, token: string) {
    await notificationRepository.upsertPushToken(userId, token, 'fcm')
  },

  async unregisterPushToken(userId: string, token: string) {
    await notificationRepository.deletePushToken(userId, token)
  },

  async unsubscribeFromTrip(userId: string, tripId: string) {
    await notificationRepository.removeTripSubscription(userId, tripId)
  },

  async sendMemoryUpdate(actorId: string, tripId: string, dayId: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')

    if (!await tripRepository.hasAccess(tripId, actorId))
      throw createTRPCError('FORBIDDEN', 'Нет доступа к путешествию')

    const day = await dayRepository.findByIdWithOwner(dayId)
    if (!day || day.tripId !== tripId)
      throw createTRPCError('NOT_FOUND', 'День путешествия не найден')

    const [tokens, pushTokens] = await Promise.all([
      notificationRepository.getSubscribersTokens(tripId, actorId),
      notificationRepository.getSubscribersPushTokens(tripId, actorId, 'fcm'),
    ])

    if (tokens.length === 0 && pushTokens.length === 0)
      return

    const route = `/trip/${tripId}?day=${dayId}&section=memories`
    const payload = JSON.stringify({
      title: `Новые фото в "${trip.title}"`,
      body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
      icon: '/pwa-192x192.png',
      data: {
        url: route,
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

    await this.sendFcmMemoryUpdate(pushTokens, trip.title, route)
  },

  async sendFcmMemoryUpdate(
    tokenRecords: { token: string }[],
    tripTitle: string,
    route: string,
  ) {
    if (!hasFcmServiceAccountConfigured()) {
      if (tokenRecords.length > 0) {
        console.warn('[FCM] Service account credentials are not configured; native push delivery is skipped.')
      }
      return
    }

    const deepLink = `trip-scheduler://${route.replace(/^\//, '')}`

    await Promise.allSettled(tokenRecords.map(async ({ token }) => {
      try {
        const result = await sendFcmMessage(token, {
          title: `Новые фото в "${tripTitle}"`,
          body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
          url: deepLink,
        })

        if (result.ok)
          return

        if (result.errorCode === 'UNREGISTERED') {
          await notificationRepository.deletePushTokenByToken(token)
          return
        }

        console.error(`[FCM] Delivery failed with HTTP ${result.status}: ${result.errorCode ?? 'unknown error'}.`)
      }
      catch (error) {
        console.error('[FCM] Delivery request failed.', error)
      }
    }))
  },
}
