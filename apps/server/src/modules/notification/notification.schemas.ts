import { z } from 'zod'

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

export const UnsubscribeFromTripInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const SendMemoryUpdateInputSchema = z.object({
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
})
