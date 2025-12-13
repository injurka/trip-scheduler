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
  SignOutResponseSchema,
  SignUpInputSchema,
  SuccessResponseSchema,
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
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/plans',
        tags: ['Users'],
        summary: 'Получить список тарифных планов',
      },
    })
    .output(z.array(PlanSchema))
    .query(async () => {
      return userService.listPlans()
    }),

  signUp: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/signup',
        tags: ['Auth'],
        summary: 'Регистрация пользователя',
      },
    })
    .input(SignUpInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ input }) => {
      return userService.signUp(input)
    }),

  verifyEmail: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/verify',
        tags: ['Auth'],
        summary: 'Подтверждение email',
      },
    })
    .input(VerifyEmailInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.verifyEmail(input)
    }),

  signIn: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/signin',
        tags: ['Auth'],
        summary: 'Вход по email/паролю',
      },
    })
    .input(SignInInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.signIn(input)
    }),

  signOut: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/signout',
        tags: ['Auth'],
        summary: 'Выход (аннулирование токенов)',
      },
    })
    .output(SignOutResponseSchema)
    .mutation(async ({ ctx }) => {
      return userService.signOut(ctx.user.id.toString())
    }),

  signInWithTelegram: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/telegram',
        tags: ['Auth'],
        summary: 'Вход через Telegram',
      },
    })
    .input(TelegramAuthPayloadSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return oAuthService.handleTelegram(input)
    }),

  refresh: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/refresh',
        tags: ['Auth'],
        summary: 'Обновление токенов',
      },
    })
    .input(RefreshTokenInputSchema)
    .output(RefreshOutputSchema)
    .mutation(async ({ input }) => {
      return userService.refresh(input.refreshToken)
    }),

  me: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/me',
        tags: ['Users'],
        summary: 'Получить текущего пользователя',
      },
    })
    .output(UserSchema.nullable())
    .query(async ({ ctx }) => {
      return userService.getById(ctx.user.id.toString())
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/{id}',
        tags: ['Users'],
        summary: 'Получить пользователя по ID',
      },
    })
    .input(GetUserByIdInputSchema)
    .output(UserSchema.nullable())
    .query(async ({ input }) => {
      return userService.getById(input.id)
    }),

  getStats: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/me/stats',
        tags: ['Users'],
        summary: 'Получить статистику текущего пользователя',
      },
    })
    .output(UserStatsSchema)
    .query(async ({ ctx }) => {
      return userService.getStats(ctx.user.id.toString())
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/users/me',
        tags: ['Users'],
        summary: 'Обновить профиль пользователя',
      },
    })
    .input(UpdateUserInputSchema)
    .output(UserSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.update(ctx.user.id.toString(), input)
    }),

  updateStatus: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/users/me/status',
        tags: ['Users'],
        summary: 'Обновить статус пользователя',
      },
    })
    .input(UpdateUserStatusInputSchema)
    .output(UserSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      return userService.updateStatus(ctx.user.id.toString(), input)
    }),

  changePassword: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users/me/password',
        tags: ['Users'],
        summary: 'Сменить пароль',
      },
    })
    .input(ChangePasswordInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.changePassword(ctx.user.id.toString(), input)
    }),

  deleteAccount: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/users/me',
        tags: ['Users'],
        summary: 'Удалить аккаунт',
      },
    })
    .input(DeleteAccountInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.deleteAccount(ctx.user.id.toString(), input)
    }),
}
