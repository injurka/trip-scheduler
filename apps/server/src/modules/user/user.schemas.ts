import { z } from 'zod'

export const SignUpInputSchema = z.object({
  name: z.string().min(1, 'Имя не может быть пустым'),
  email: z.string().email('Некорректный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
})

export const VerifyEmailInputSchema = z.object({
  email: z.string().email('Некорректный формат email'),
  token: z.string().min(6).max(6),
})

export const SignInInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const TelegramAuthPayloadSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
})

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string(),
})

export const GetUserByIdInputSchema = z.object({
  id: z.string(),
})

export const UpdateUserInputSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
}).strict()

export const UpdateUserStatusInputSchema = z.object({
  statusText: z.string().max(100).optional().nullable(),
  statusEmoji: z.string().max(10).optional().nullable(),
})

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
})

export const DeleteAccountInputSchema = z.object({
  password: z.string(),
})

export const PlanSchema = z.object({
  id: z.string(), 
  name: z.string(),
  maxTrips: z.number(),
  maxStorageBytes: z.number(),
  monthlyLlmCredits: z.number(),
  isDeveloping: z.boolean(),
})

export const UserSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'admin']),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  emailVerified: z.union([z.string(), z.date()]).nullable().optional(), 
  plan: PlanSchema.optional(),
  _count: z.object({
    trips: z.number(),
  }).optional(),
})

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

export const AuthOutputSchema = z.object({
  user: UserSchema,
  token: TokenPairSchema,
})

export const RefreshOutputSchema = z.object({
  token: TokenPairSchema,
})

export const UserStatsSchema = z.object({
  trips: z.number(),
})

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})

export const SignOutResponseSchema = z.object({
  ok: z.boolean(),
})
