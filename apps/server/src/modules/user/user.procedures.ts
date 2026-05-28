import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  AuthOutputSchema,
  ChangePasswordInputSchema,
  CreateHighlightInputSchema,
  DeleteAccountInputSchema,
  DeleteHighlightInputSchema,
  GetUserByIdInputSchema,
  GetUserHighlightsInputSchema,
  HighlightSchema,
  PlanSchema,
  RefreshOutputSchema,
  RefreshTokenInputSchema,
  SearchUserInputSchema,
  SignInInputSchema,
  SignOutResponseSchema,
  SignUpInputSchema,
  SuccessResponseSchema,
  UpdateUserInputSchema,
  UpdateUserStatusInputSchema,
  UserSchema,
  UserSearchResultSchema,
  UserStatsSchema,
  VerifyEmailInputSchema,
} from './user.schemas'
import { userService } from './user.service'

export const userProcedures = {
  listPlans: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/plans', tags: ['Users'], summary: 'Получить список тарифных планов' },
    })
    .output(z.array(PlanSchema))
    .query(async () => {
      return userService.listPlans()
    }),

  signUp: publicProcedure
    .meta({
      openapi: { method: 'POST', path: '/auth/signup', tags: ['Auth'], summary: 'Регистрация пользователя' },
    })
    .input(SignUpInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ input }) => {
      return userService.signUp(input)
    }),

  verifyEmail: publicProcedure
    .meta({
      openapi: { method: 'POST', path: '/auth/verify', tags: ['Auth'], summary: 'Подтверждение email' },
    })
    .input(VerifyEmailInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.verifyEmail(input)
    }),

  signIn: publicProcedure
    .meta({
      openapi: { method: 'POST', path: '/auth/signin', tags: ['Auth'], summary: 'Вход по email/паролю' },
    })
    .input(SignInInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.signIn(input)
    }),

  signOut: protectedProcedure
    .meta({
      openapi: { method: 'POST', path: '/auth/signout', tags: ['Auth'], summary: 'Выход (аннулирование токенов)' },
    })
    .output(SignOutResponseSchema)
    .mutation(async ({ ctx }) => {
      return userService.signOut(ctx.user.id)
    }),

  refresh: publicProcedure
    .meta({
      openapi: { method: 'POST', path: '/auth/refresh', tags: ['Auth'], summary: 'Обновление токенов' },
    })
    .input(RefreshTokenInputSchema)
    .output(RefreshOutputSchema)
    .mutation(async ({ input }) => {
      return userService.refresh(input.refreshToken)
    }),

  me: protectedProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/me', tags: ['Users'], summary: 'Получить текущего пользователя' },
    })
    .output(UserSchema.nullable())
    .query(async ({ ctx }) => {
      return userService.getById(ctx.user.id)
    }),

  getById: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/{id}', tags: ['Users'], summary: 'Получить пользователя по ID' },
    })
    .input(GetUserByIdInputSchema)
    .output(UserSchema.nullable())
    .query(async ({ input }) => {
      return userService.getById(input.id)
    }),

  getStats: protectedProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/me/stats', tags: ['Users'], summary: 'Получить статистику текущего пользователя' },
    })
    .output(UserStatsSchema)
    .query(async ({ ctx }) => {
      return userService.getStats(ctx.user.id)
    }),

  update: protectedProcedure
    .meta({
      openapi: { method: 'PATCH', path: '/users/me', tags: ['Users'], summary: 'Обновить профиль пользователя' },
    })
    .input(UpdateUserInputSchema)
    .output(UserSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.update(ctx.user.id, input)
    }),

  updateStatus: protectedProcedure
    .meta({
      openapi: { method: 'PATCH', path: '/users/me/status', tags: ['Users'], summary: 'Обновить статус пользователя' },
    })
    .input(UpdateUserStatusInputSchema)
    .output(UserSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      return userService.updateStatus(ctx.user.id, input)
    }),

  changePassword: protectedProcedure
    .meta({
      openapi: { method: 'POST', path: '/users/me/password', tags: ['Users'], summary: 'Сменить пароль' },
    })
    .input(ChangePasswordInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.changePassword(ctx.user.id, input)
    }),

  deleteAccount: protectedProcedure
    .meta({
      openapi: { method: 'DELETE', path: '/users/me', tags: ['Users'], summary: 'Удалить аккаунт' },
    })
    .input(DeleteAccountInputSchema)
    .output(SuccessResponseSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.deleteAccount(ctx.user.id, input)
    }),

  search: protectedProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/search', tags: ['Users'], summary: 'Поиск пользователей' },
    })
    .input(SearchUserInputSchema)
    .output(z.array(UserSearchResultSchema))
    .query(async ({ input }) => {
      return userService.search(input.query)
    }),

  getHighlights: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/{userId}/highlights', tags: ['Users'], summary: 'Получить витрину пользователя' },
    })
    .input(GetUserHighlightsInputSchema)
    .output(z.object({ items: z.array(HighlightSchema), total: z.number() }))
    .query(async ({ input }) => {
      return userService.getHighlights(input)
    }),

  getHighlightCities: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/users/{userId}/highlights/cities', tags: ['Users'], summary: 'Получить города витрины пользователя' },
    })
    .input(z.object({ userId: z.string().uuid() }))
    .output(z.array(z.string()))
    .query(async ({ input }) => {
      return userService.getHighlightCities(input.userId)
    }),

  createHighlight: protectedProcedure
    .meta({
      openapi: { method: 'POST', path: '/users/highlights', tags: ['Users'], summary: 'Добавить фото в витрину' },
    })
    .input(CreateHighlightInputSchema)
    .output(HighlightSchema)
    .mutation(async ({ input, ctx }) => {
      return userService.createHighlight(input, ctx.user.id)
    }),

  deleteHighlight: protectedProcedure
    .meta({
      openapi: { method: 'DELETE', path: '/users/highlights/{id}', tags: ['Users'], summary: 'Удалить фото из витрины' },
    })
    .input(DeleteHighlightInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return userService.deleteHighlight(input.id, ctx.user.id)
    }),
}
