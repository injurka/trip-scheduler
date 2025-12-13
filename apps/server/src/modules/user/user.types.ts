import type { RecordId } from 'surrealdb'

export type AnyId = string | RecordId

// --- DB Records (Raw from DB) ---

export type PlanRecord = {
  id: AnyId
  name: string
  maxTrips: number
  maxStorageBytes: number
  monthlyLlmCredits: number
  isDeveloping: boolean
}

export type UserRecord = {
  id: AnyId
  role: 'user' | 'admin'
  email: string
  name?: string | null
  avatarUrl?: string | null
  password?: string | null
  emailVerified?: Date | string | null

  // Поля для OAuth
  googleId?: string | null
  githubId?: string | null
  telegramId?: string | null

  // Связанный план
  plan?: PlanRecord

  // Лимиты и статистика
  currentTripsCount: number
  currentStorageBytes: number
  llmCreditsUsed: number
  llmCreditsPeriodStartDate: Date | string

  // Статус
  statusText?: string | null
  statusEmoji?: string | null

  createdAt: Date | string
  updatedAt: Date | string
}

export type RefreshToken = {
  id: AnyId
  token: string
  userId: AnyId
  expiresAt: Date | string
  createdAt: Date | string
}

// --- Client Types (Sanitized for API) ---

export type PlanForClient = {
  id: string
  name: string
  maxTrips: number
  maxStorageBytes: number
  monthlyLlmCredits: number
  isDeveloping: boolean
}

export type UserForClient = Omit<UserRecord, 'password' | 'id' | 'plan'> & {
  id: string
  plan?: PlanForClient
  _count: { trips: number }
}

// Alias для совместимости
export type User = UserRecord
