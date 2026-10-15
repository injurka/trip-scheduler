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

    await notificationRepository.upsertPushSubscription(userId, subscription)
    await notificationRepository.addTripSubscription(userId, tripId)
  },

  async subscribeToTripWithPushToken(userId: string, tripId: string, token: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip) {
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    }

    await notificationRepository.upsertPushToken(userId, token)
    await notificationRepository.addTripSubscription(userId, tripId)
  },

  async registerPushToken(userId: string, token: string) {
    if (await notificationRepository.hasAnyTripSubscription(userId)) {
      await notificationRepository.upsertPushToken(userId, token)
    }
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
      return

    const [tokens, pushTokens] = await Promise.all([
      notificationRepository.getSubscribersTokens(tripId, actorId),
      notificationRepository.getSubscribersPushTokens(tripId, actorId),
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

    await this.sendPushMemoryUpdate(pushTokens, trip.title, route)
  },

  async sendPushMemoryUpdate(
    tokenRecords: { token: string }[],
    tripTitle: string,
    route: string,
  ) {
    const projectId = process.env.RUSTORE_PUSH_PROJECT_ID
    const serviceToken = process.env.RUSTORE_PUSH_SERVICE_TOKEN

    if (!projectId || !serviceToken) {
      if (tokenRecords.length > 0) {
        console.warn('[RuStore Push] Project ID or service token is not configured; native push delivery is skipped.')
      }
      return
    }

    const deepLink = `trip-scheduler://${route.replace(/^\//, '')}`
    const endpoint = `https://vkpns.rustore.ru/v1/projects/${encodeURIComponent(projectId)}/messages:send`

    await Promise.allSettled(tokenRecords.map(async ({ token }) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: `Новые фото в "${tripTitle}"`,
                body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
              },
              data: { url: deepLink },
              android: {
                notification: {
                  click_action: deepLink,
                  click_action_type: 1,
                },
              },
            },
          }),
        })

        if (response.ok)
          return

        const responseBody = await response.json().catch(() => null) as { error?: { status?: string, message?: string } } | null
        const isExpired = response.status === 404 || responseBody?.error?.status === 'NOT_FOUND'
        const isInvalidToken = response.status === 400
          && /registration token/i.test(responseBody?.error?.message ?? '')

        if (isExpired || isInvalidToken) {
          await notificationRepository.deletePushTokenByToken(token)
          return
        }

        console.error(`[RuStore Push] Delivery failed with HTTP ${response.status}.`)
      }
      catch (error) {
        console.error('[RuStore Push] Delivery request failed.', error)
      }
    }))
  },
}
