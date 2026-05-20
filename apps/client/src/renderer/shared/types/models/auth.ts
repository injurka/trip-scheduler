import type { Plan } from './plan'
import type { RouterInput, RouterOutput } from '~/shared/types/trpc'

/**
 * Тип данных пользователя, полученный из tRPC.
 * @example RouterOutput['user']['me']
 */
export type User = RouterOutput['user']['me'] & {
  plan?: Plan
  currentTripsCount: number
  currentStorageBytes: number
  llmCreditsUsed: number
}

/**
 * Тип для пары токенов (access и refresh), полученный из tRPC.
 * @example RouterOutput['user']['signIn']['token']
 */
export type TokenPair = RouterOutput['user']['signIn']['token']

/**
 * Тип данных для входа в систему, на основе tRPC-ввода.
 * @example RouterInput['user']['signIn']
 */
export type SignInPayload = RouterInput['user']['signIn']

/**
 * Тип данных для регистрации, на основе tRPC-ввода.
 * @example RouterInput['user']['signUp']
 */
export type SignUpPayload = RouterInput['user']['signUp']