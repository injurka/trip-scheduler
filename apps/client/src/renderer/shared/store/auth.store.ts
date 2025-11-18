import type { SignInPayload, SignUpPayload, TelegramAuthPayload, TokenPair, User } from '../types/models/auth'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'

export const TOKEN_KEY = 'auth_token'
export const REFRESH_TOKEN_KEY = 'auth_refresh_token'

export enum EAuthRequestKeys {
  ME = 'auth:me',
  REFRESH = 'auth:refresh',
  SIGN_IN = 'auth:sign-in',
  SIGN_UP = 'auth:sign-up',
  SIGN_IN_TG = 'auth:sign-in-telegram',
  VERIFY_EMAIL = 'auth:verify-email',
  SIGN_OUT = 'auth:sign-out',
  UPDATE_STATUS = 'auth:update-status',
  UPDATE_USER = 'auth:update-user',
  UPLOAD_AVATAR = 'auth:upload-avatar',
}

export interface IAuthState {
  user: User | null
  tokenPair: Partial<TokenPair>
  isInitialized: boolean
}

// --- Хранилище ---

export const useAuthStore = defineStore('auth', {
  state: (): IAuthState => {
    const accessToken = useStorage<string | null>(TOKEN_KEY, null)
    const refreshToken = useStorage<string | null>(REFRESH_TOKEN_KEY, null)

    return {
      isInitialized: false,
      user: null,
      tokenPair: { accessToken: accessToken.value ?? null, refreshToken: refreshToken.value ?? null } as Partial<TokenPair>,
    }
  },

  getters: {
    isLoading: () => useRequestStatus(Object.values(EAuthRequestKeys)).value,
    isAuthenticated: state => !!state.user,

    canCreateTrip(state): boolean {
      if (!state.user || !state.user.plan)
        return false
      return state.user.currentTripsCount < state.user.plan.maxTrips
    },
    remainingStorageBytes(state): number {
      if (!state.user || !state.user.plan)
        return 0
      return state.user.plan.maxStorageBytes - state.user.currentStorageBytes
    },
  },

  actions: {
    /**
     * Получает информацию о текущем пользователе с сервера через tRPC.
     */
    async me() {
      return useRequest<User>({
        key: EAuthRequestKeys.ME,
        fn: db => db.auth.me(),
        onSuccess: (data) => {
          this.user = data
        },
        onError: (error) => {
          this.user = null
          throw error
        },
      })
    },

    /**
     * Обновляет токен доступа, используя токен обновления из состояния.
     */
    async refresh() {
      const refreshToken = this.tokenPair?.refreshToken
      if (!refreshToken) {
        return Promise.reject(new Error('Refresh token is not available.'))
      }

      return useRequest({
        key: EAuthRequestKeys.REFRESH,
        fn: db => db.auth.refresh(refreshToken),
        onSuccess: (data) => {
          this.saveTokens(data.token)
        },
        onError: (error) => {
          this.clearAuth()
          throw error
        },
      })
    },

    /**
     * Выход пользователя из системы через tRPC.
     */
    async signOut() {
      return useRequest<void>({
        key: EAuthRequestKeys.SIGN_OUT,
        fn: db => db.auth.signOut(),
        onSuccess: () => {
          this.clearAuth()
        },
        onError: (error) => {
          this.clearAuth()
          throw error
        },
      })
    },

    /**
     * Авторизует пользователя через Telegram.
     */
    async signInWithTelegram(authData: TelegramAuthPayload) {
      return useRequest({
        key: EAuthRequestKeys.SIGN_IN_TG,
        fn: db => db.auth.signInWithTelegram(authData),
        onSuccess: (data) => {
          this.user = data.user
          this.saveTokens(data.token)
        },
        onError: (error) => {
          this.clearAuth()
          throw error
        },
      })
    },

    /**
     * Авторизует пользователя по email и паролю через tRPC.
     */
    async signIn(payload: SignInPayload) {
      return useRequest({
        key: EAuthRequestKeys.SIGN_IN,
        fn: db => db.auth.signIn(payload),
        onSuccess: (data) => {
          this.user = data.user
          this.saveTokens(data.token)
        },
        onError: (error) => {
          this.clearAuth()
          throw error
        },
      })
    },

    /**
     * Регистрирует нового пользователя.
     */
    async signUp(payload: SignUpPayload) {
      return useRequest({
        key: EAuthRequestKeys.SIGN_UP,
        fn: db => db.auth.signUp(payload),
        onError: (error) => {
          throw error
        },
      })
    },

    /**
     * Подтверждает email и завершает регистрацию.
     */
    async verifyEmail(payload: { email: string, token: string }) {
      return useRequest({
        key: EAuthRequestKeys.VERIFY_EMAIL,
        fn: db => db.auth.verifyEmail(payload),
        onSuccess: (data) => {
          this.user = data.user
          this.saveTokens(data.token)
        },
        onError: (error) => {
          this.clearAuth()
          throw error
        },
      })
    },

    /**
     * Обновляет статус пользователя.
     */
    async updateStatus(data: { statusText?: string | null, statusEmoji?: string | null }) {
      return useRequest<User>({
        key: EAuthRequestKeys.UPDATE_STATUS,
        fn: db => db.auth.updateStatus(data),
        onSuccess: (updatedUser) => {
          if (updatedUser) {
            this.user = updatedUser
            useToast().success('Статус обновлен')
          }
        },
        onError: (error: any) => {
          useToast().error(`Не удалось обновить статус: ${error.message || error}`)
          throw error
        },
      })
    },

    /**
     * Сохраняет пару токенов в состояние и в localStorage.
     */
    saveTokens(tokens: TokenPair) {
      this.tokenPair = tokens
      useStorage(TOKEN_KEY, '').value = tokens.accessToken
      useStorage(REFRESH_TOKEN_KEY, '').value = tokens.refreshToken
    },

    /**
     * Очищает токены из состояния и из localStorage.
     */
    clearTokens() {
      this.tokenPair = {
        accessToken: '',
        refreshToken: '',
      }
      useStorage(TOKEN_KEY, null).value = null
      useStorage(REFRESH_TOKEN_KEY, null).value = null
    },

    /**
     * Полностью очищает данные аутентификации.
     */
    clearAuth() {
      this.user = null
      this.clearTokens()
    },

    /**
     * Увеличивает счетчик путешествий на клиенте.
     */
    incrementTripCount() {
      if (this.user) {
        this.user.currentTripsCount++
      }
    },

    /**
     * Уменьшает счетчик путешествий на клиенте.
     */
    decrementTripCount() {
      if (this.user && this.user.currentTripsCount > 0) {
        this.user.currentTripsCount--
      }
    },

    /**
     * Увеличивает использование хранилища на клиенте.
     * @param bytes - Размер добавленного файла в байтах.
     */
    incrementStorageUsage(bytes: number) {
      if (this.user) {
        this.user.currentStorageBytes += bytes
      }
    },

    /**
     * Обновляет данные профиля пользователя (имя, аватар).
     */
    async updateUser(data: { name?: string, avatarUrl?: string }) {
      return useRequest<User>({
        key: EAuthRequestKeys.UPDATE_USER,
        fn: db => db.auth.updateUser(data),
        onSuccess: (updatedUser) => {
          if (this.user && updatedUser) {
            this.user = { ...this.user, ...updatedUser }
          }
        },
        onError: (error) => {
          throw error
        },
      })
    },

    /**
     * Загружает аватар пользователя.
     */
    async uploadAvatar(file: File) {
      await useRequest<User>({
        key: EAuthRequestKeys.UPLOAD_AVATAR,
        fn: db => db.auth.uploadAvatar(file),
        onSuccess: (updatedUser) => {
          if (this.user && updatedUser) {
            this.user = { ...this.user, ...updatedUser }
          }
        },
        onError: (error) => {
          throw error
        },
      })
    },

    /**
     * Уменьшает использование хранилища на клиенте.
     * @param bytes - Размер удаленного файла в байтах.
     */
    decrementStorageUsage(bytes: number) {
      if (this.user) {
        this.user.currentStorageBytes = Math.max(0, this.user.currentStorageBytes - bytes)
      }
    },
  },
})
