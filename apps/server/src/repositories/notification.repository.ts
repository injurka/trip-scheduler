import type { PushSubscription as WebPushSubscription } from 'web-push'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '~/../db'
import { pushSubscriptions, tripSubscriptions } from '~/../db/schema'

export const notificationRepository = {
  /**
   * Сохраняет или обновляет техническую подписку (токен устройства) для пользователя.
   */
  async upsertPushSubscription(userId: string, subscription: WebPushSubscription) {
    await db.insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys as { p256dh: string, auth: string },
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, keys: subscription.keys as any, updatedAt: new Date() },
      })
  },

  /**
   * Удаляет невалидную подписку (например, если сервер получил 410 Gone).
   */
  async deletePushSubscription(endpoint: string) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  },

  /**
   * Создает связь "Пользователь хочет получать уведомления о Путешествии".
   */
  async addTripSubscription(userId: string, tripId: string) {
    await db.insert(tripSubscriptions)
      .values({ userId, tripId })
      .onConflictDoNothing()
  },

  /**
   * Удаляет связь подписки на путешествие.
   */
  async removeTripSubscription(userId: string, tripId: string) {
    await db.delete(tripSubscriptions)
      .where(and(
        eq(tripSubscriptions.userId, userId),
        eq(tripSubscriptions.tripId, tripId),
      ))
  },

  /**
   * Проверяет наличие подписки.
   */
  async hasTripSubscription(userId: string, tripId: string): Promise<boolean> {
    const record = await db.query.tripSubscriptions.findFirst({
      where: and(
        eq(tripSubscriptions.userId, userId),
        eq(tripSubscriptions.tripId, tripId),
      ),
    })
    return !!record
  },

  /**
   * Находит все активные push-токены пользователей, подписанных на путешествие,
   * исключая самого инициатора события.
   */
  async getSubscribersTokens(tripId: string, excludeUserId: string) {
    const subs = await db.query.tripSubscriptions.findMany({
      where: eq(tripSubscriptions.tripId, tripId),
      columns: { userId: true },
    })

    const userIds = subs
      .map(s => s.userId)
      .filter(id => id !== excludeUserId)

    if (userIds.length === 0)
      return []

    const tokens = await db.query.pushSubscriptions.findMany({
      where: inArray(pushSubscriptions.userId, userIds),
    })

    return tokens
  },
}
