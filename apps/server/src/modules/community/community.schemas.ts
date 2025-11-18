import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { communities, communityPrivacyEnum } from '~/../db/schema'
import { UserSchema } from '~/modules/user/user.schemas'

export const CommunitySchema = createSelectSchema(communities).extend({
  owner: UserSchema.pick({ id: true, name: true, avatarUrl: true }),
  _count: z.object({
    members: z.number(),
  }).optional(),
})

export const CreateCommunityInputSchema = z.object({
  name: z.string().min(3, 'Название должно быть не менее 3 символов').max(50, 'Название не должно превышать 50 символов'),
  description: z.string().max(500, 'Описание не должно превышать 500 символов').optional(),
  privacyType: z.enum(communityPrivacyEnum.enumValues).default('public'),
})

export const ListCommunitiesInputSchema = z.object({
  tab: z.enum(['my', 'public']).optional().default('public'),
  search: z.string().optional(),
  // Другие фильтры можно добавить позже
}).optional()

export const GetCommunityByIdInputSchema = z.object({
  id: z.string().uuid(),
})
