import type { PushSubscription as WebPushSubscription } from 'web-push'
import type { NotificationChannelDelivery } from './notification.schemas'
import webpush from 'web-push'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { notificationRepository } from '~/repositories/notification.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { FcmRequestError, hasFcmServiceAccountConfigured, sendFcmMessage } from './fcm'

function deliveryReport(attempted: number): NotificationChannelDelivery {
  return { attempted, accepted: 0, failed: 0, skipped: 0, errorCodes: [] }
}

function recordError(report: NotificationChannelDelivery, code: string) {
  if (!report.errorCodes.includes(code))
    report.errorCodes.push(code)
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@trip-scheduler.ru',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}
else {
  console.warn('[Web Push] VAPID keys are missing; browser notifications are unavailable.')
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

    const web = deliveryReport(tokens.length)
    const webConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    if (!webConfigured && tokens.length > 0) {
      web.skipped = tokens.length
      recordError(web, 'NOT_CONFIGURED')
    }

    const route = `/trip/${tripId}?day=${dayId}&view=memories`
    const payload = JSON.stringify({
      title: `Новые фото в "${trip.title}"`,
      body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
      icon: '/pwa-192x192.png',
      data: {
        url: route,
      },
      tag: `trip-memory-${tripId}`,
    })

    const sendPromises = (webConfigured ? tokens : []).map(async (tokenRecord: { endpoint: string, keys: { p256dh: string, auth: string } }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: tokenRecord.endpoint,
            keys: tokenRecord.keys as { p256dh: string, auth: string },
          },
          payload,
        )
        web.accepted++
      }
      catch (error: any) {
        web.failed++
        recordError(web, error.statusCode ? `HTTP_${error.statusCode}` : 'REQUEST_FAILED')
        if (error.statusCode === 410 || error.statusCode === 404) {
          await notificationRepository.deletePushSubscription(tokenRecord.endpoint)
        }
        else {
          console.error(`[Web Push] Delivery failed: ${error.statusCode ?? 'REQUEST_FAILED'}.`)
        }
      }
    })

    const [, fcm] = await Promise.all([
      Promise.allSettled(sendPromises),
      this.sendFcmMemoryUpdate(pushTokens, trip.title, route),
    ])
    const report = { web, fcm }
    // Counts and provider error codes only: never log recipient tokens or keys.
    process.stdout.write(`[Push] Memory notification summary ${JSON.stringify(report)}\n`)
    return report
  },

  async sendFcmMemoryUpdate(
    tokenRecords: { token: string }[],
    tripTitle: string,
    route: string,
  ) {
    const report = deliveryReport(tokenRecords.length)
    if (tokenRecords.length === 0)
      return report

    if (!hasFcmServiceAccountConfigured()) {
      report.skipped = tokenRecords.length
      recordError(report, 'NOT_CONFIGURED')
      console.warn('[FCM] Service account credentials are not configured; native push delivery is skipped.')
      return report
    }

    const deepLink = `trip-scheduler://${route.replace(/^\//, '')}`

    await Promise.allSettled(tokenRecords.map(async ({ token }) => {
      try {
        const result = await sendFcmMessage(token, {
          title: `Новые фото в "${tripTitle}"`,
          body: 'Кто-то поделился воспоминаниями. Нажмите, чтобы посмотреть.',
          url: deepLink,
        })

        if (result.ok) {
          report.accepted++
          return
        }

        report.failed++
        recordError(report, result.errorCode ?? `HTTP_${result.status}`)

        if (result.errorCode === 'UNREGISTERED') {
          await notificationRepository.deletePushTokenByToken(token)
          return
        }

        console.error(`[FCM] Delivery failed with HTTP ${result.status}: ${result.errorCode ?? 'unknown error'}.`)
      }
      catch (error) {
        const code = error instanceof FcmRequestError ? error.code : 'REQUEST_FAILED'
        recordError(report, code)
        console.error(`[FCM] Delivery request failed: ${code}.`)
      }
    }))
    // Include transport/auth failures without counting cleanup errors twice.
    report.failed = tokenRecords.length - report.accepted
    return report
  },
}
