import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { highlights, plans, users } from '~/../db/schema'
import { CountrySchema } from '../destination-review/destination-review.schemas'

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

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string(),
})

export const SearchUserInputSchema = z.object({
  query: z.string().min(2, 'Минимум 2 символа'),
})

export const GetUserByIdInputSchema = z.object({
  id: z.string().uuid(),
})

export const UpdateUserInputSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().optional(),
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

// --- HIGHLIGHT SCHEMAS ---

export const HighlightSchema = createSelectSchema(highlights).extend({
  country: CountrySchema.optional().nullable(),
  metadata: z.any().nullable().optional(),
})

export const GetUserHighlightsInputSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(30),
  page: z.number().min(1).default(1),
})

export const CreateHighlightInputSchema = z.object({
  imageUrl: z.string(),
  countryId: z.string().min(2),
  city: z.string().min(1),
  address: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),

  takenAt: z.union([z.string(), z.date()]).optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  variants: z.record(z.string(), z.string()).optional().nullable(),
  metadata: z.any().optional().nullable(),
})

export const DeleteHighlightInputSchema = z.object({
  id: z.string().uuid(),
})

// --- Исходящие данные (Output) ---

export const PlanSchema = createSelectSchema(plans)

export const UserSchema = createSelectSchema(users)
  .omit({ password: true })
  .extend({
    plan: PlanSchema.optional(),
    _count: z.object({
      trips: z.number(),
    }).optional(),
  })

export const UserSearchResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
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
