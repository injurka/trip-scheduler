import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { oAuthService } from '~/services/oauth.service'
import {
  AuthOutputSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  GetUserByIdInputSchema,
  PlanSchema,
  RefreshOutputSchema,
  RefreshTokenInputSchema,
  SignInInputSchema,
  SignUpInputSchema,
  TelegramAuthPayloadSchema,
  UpdateUserInputSchema,
  UpdateUserStatusInputSchema,
  UserSchema,
  UserStatsSchema,
  VerifyEmailInputSchema,
} from './user.schemas'
import { userService } from './user.service'

export const userProcedures = {
  listPlans: publicProcedure
    .output(z.array(PlanSchema))
    .query(async () => {
      return userService.listPlans()
    }),

  signUp: publicProcedure
    .input(SignUpInputSchema)
    .mutation(async ({ input }) => {
      return userService.signUp(input)
    }),

  verifyEmail: publicProcedure
    .input(VerifyEmailInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.verifyEmail(input)
    }),

  signIn: publicProcedure
    .input(SignInInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.signIn(input)
    }),

  signOut: protectedProcedure
    .mutation(async ({ ctx }) => {
      return userService.signOut(ctx.user.id)
    }),

  signInWithTelegram: publicProcedure
    .input(TelegramAuthPayloadSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return oAuthService.handleTelegram(input)
    }),

  refresh: publicProcedure
    .input(RefreshTokenInputSchema)
    .output(RefreshOutputSchema)
    .mutation(async ({ input }) => {
      return userService.refresh(input.refreshToken)
    }),

  me: protectedProcedure
    .output(UserSchema)
    .query(async ({ ctx }) => {
      return userService.getById(ctx.user.id)
    }),

  getById: publicProcedure
    .input(GetUserByIdInputSchema)
    .output(UserSchema)
    .query(async ({ input }) => {
      return userService.getById(input.id)
    }),

  getStats: protectedProcedure
    .output(UserStatsSchema)
    .query(async ({ ctx }) => {
      return userService.getStats(ctx.user.id)
    }),

  update: protectedProcedure
    .input(UpdateUserInputSchema)
    .output(UserSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.update(ctx.user.id, input)
    }),

  updateStatus: protectedProcedure
    .input(UpdateUserStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.updateStatus(ctx.user.id, input)
    }),

  changePassword: protectedProcedure
    .input(ChangePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.changePassword(ctx.user.id, input)
    }),

  deleteAccount: protectedProcedure
    .input(DeleteAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.deleteAccount(ctx.user.id, input)
    }),
}
