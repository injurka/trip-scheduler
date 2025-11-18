import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { plans, users } from '~/../db/schema'

// --- Входящие данные (Input) ---

export const SignUpInputSchema = z.object({
  name: z.string().min(1, 'Имя не может быть пустым'),
  email: z.string().email('Некорректный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
})

export const VerifyEmailInputSchema = z.object({
  email: z.string().email('Некорректный формат email'),
  token: z.string().min(6, 'Код должен содержать 6 символов').max(6, 'Код должен содержать 6 символов'),
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
  newPassword: z.string().min(6, 'Новый пароль должен содержать минимум 6 символов'),
})

export const DeleteAccountInputSchema = z.object({
  password: z.string(),
})

// --- Исходящие данные (Output) ---

export const PlanSchema = createSelectSchema(plans)

// Безопасная схема пользователя (без пароля) для отправки на клиент
export const UserSchema = createSelectSchema(users)
  .omit({ password: true })
  .extend({
    plan: PlanSchema.optional(),
    _count: z.object({
      communities: z.number(),
    }).optional(),
  })

// Схема для пары токенов
export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

// Схема для ответа при успешном входе или обновлении токена
export const AuthOutputSchema = z.object({
  user: UserSchema,
  token: TokenPairSchema,
})

// Схема для ответа при обновлении токена
export const RefreshOutputSchema = z.object({
  token: TokenPairSchema,
})

export const UserStatsSchema = z.object({
  trips: z.number(),
  communities: z.number(),
})
