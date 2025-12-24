import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import {
  CheckTripSubscriptionInputSchema,
  SendMemoryUpdateInputSchema,
  SubscribeToTripInputSchema,
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
