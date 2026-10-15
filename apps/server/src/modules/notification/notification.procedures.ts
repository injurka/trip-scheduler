import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import {
  CheckTripSubscriptionInputSchema,
  PushTokenInputSchema,
  SendMemoryUpdateInputSchema,
  SubscribeToTripInputSchema,
  SubscribeToTripWithPushTokenInputSchema,
  UnsubscribeFromTripInputSchema,
} from './notification.schemas'
import { notificationService } from './notification.service'

export const notificationProcedures = {
  checkTripSubscription: protectedProcedure
    .input(CheckTripSubscriptionInputSchema)
    .output(z.boolean())
    .query(async ({ input, ctx }) => {
      return notificationService.checkTripSubscription(ctx.user.id, input.tripId)
    }),

  subscribeToTrip: protectedProcedure
    .input(SubscribeToTripInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.subscribeToTrip(ctx.user.id, input.tripId, input.subscription as any)
    }),

  subscribeToTripWithPushToken: protectedProcedure
    .input(SubscribeToTripWithPushTokenInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.subscribeToTripWithPushToken(ctx.user.id, input.tripId, input.token)
    }),

  registerPushToken: protectedProcedure
    .input(PushTokenInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.registerPushToken(ctx.user.id, input.token)
    }),

  unregisterPushToken: protectedProcedure
    .input(PushTokenInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.unregisterPushToken(ctx.user.id, input.token)
    }),

  unsubscribeFromTrip: protectedProcedure
    .input(UnsubscribeFromTripInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.unsubscribeFromTrip(ctx.user.id, input.tripId)
    }),

  sendMemoryUpdate: protectedProcedure
    .input(SendMemoryUpdateInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await notificationService.sendMemoryUpdate(ctx.user.id, input.tripId, input.dayId)
    }),
}
