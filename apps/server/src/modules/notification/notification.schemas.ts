import { z } from 'zod'

export const NotificationChannelDeliverySchema = z.object({
  attempted: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errorCodes: z.array(z.string()),
})

export type NotificationChannelDelivery = z.infer<typeof NotificationChannelDeliverySchema>

export const MemoryNotificationDeliverySchema = z.object({
  web: NotificationChannelDeliverySchema,
  fcm: NotificationChannelDeliverySchema,
})

export const PushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export const CheckTripSubscriptionInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const SubscribeToTripInputSchema = z.object({
  tripId: z.string().uuid(),
  subscription: PushSubscriptionSchema,
})

export const SubscribeToTripWithPushTokenInputSchema = z.object({
  tripId: z.string().uuid(),
  token: z.string().trim().min(1).max(4096),
})

export const PushTokenInputSchema = z.object({
  token: z.string().trim().min(1).max(4096),
})

export const UnsubscribeFromTripInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const SendMemoryUpdateInputSchema = z.object({
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
})
