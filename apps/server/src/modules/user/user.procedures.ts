import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { oAuthService } from '~/services/oauth.service'
import {
  AuthOutputSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
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
  /**
   * Процедура регистрации (отправка кода).
   */
  signUp: publicProcedure
    .input(SignUpInputSchema)
    .mutation(async ({ input }) => {
      return userService.signUp(input)
    }),

  /**
   * Процедура верификации почты и завершения регистрации.
   */
  verifyEmail: publicProcedure
    .input(VerifyEmailInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.verifyEmail(input)
    }),

  /**
   * Процедура входа в систему.
   */
  signIn: publicProcedure
    .input(SignInInputSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return userService.signIn(input)
    }),

  /**
   * Процедура выхода из системы.
   */
  signOut: protectedProcedure
    .mutation(async ({ ctx }) => {
      return userService.signOut(ctx.user.id)
    }),

  /**
   * Процедура входа через Telegram.
   */
  signInWithTelegram: publicProcedure
    .input(TelegramAuthPayloadSchema)
    .output(AuthOutputSchema)
    .mutation(async ({ input }) => {
      return oAuthService.handleTelegram(input)
    }),

  /**
   * Процедура обновления токенов.
   */
  refresh: publicProcedure
    .input(RefreshTokenInputSchema)
    .output(RefreshOutputSchema)
    .mutation(async ({ input }) => {
      return userService.refresh(input.refreshToken)
    }),

  /**
   * Процедура для получения данных текущего пользователя.
   */
  me: protectedProcedure
    .output(UserSchema)
    .query(async ({ ctx }) => {
      return userService.getById(ctx.user.id)
    }),

  /**
   * Процедура для получения статистики текущего пользователя.
   */
  getStats: protectedProcedure
    .output(UserStatsSchema)
    .query(async ({ ctx }) => {
      return userService.getStats(ctx.user.id)
    }),

  /**
   * Процедура для обновления данных текущего пользователя.
   */
  update: protectedProcedure
    .input(UpdateUserInputSchema)
    .output(UserSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.update(ctx.user.id, input)
    }),

  /**
   * Процедура для обновления статуса пользователя.
   */
  updateStatus: protectedProcedure
    .input(UpdateUserStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.updateStatus(ctx.user.id, input)
    }),

  /**
   * Процедура для смены пароля.
   */
  changePassword: protectedProcedure
    .input(ChangePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.changePassword(ctx.user.id, input)
    }),

  /**
   * Процедура для удаления аккаунта.
   */
  deleteAccount: protectedProcedure
    .input(DeleteAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.deleteAccount(ctx.user.id, input)
    }),

}
