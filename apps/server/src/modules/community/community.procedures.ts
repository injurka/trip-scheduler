import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { CreateCommunityInputSchema, GetCommunityByIdInputSchema, ListCommunitiesInputSchema } from './community.schemas'
import { communityService } from './community.service'

export const communityProcedures = {
  create: protectedProcedure
    .input(CreateCommunityInputSchema)
    .mutation(async ({ input, ctx }) => {
      return communityService.create(input, ctx.user.id)
    }),

  list: publicProcedure
    .input(ListCommunitiesInputSchema)
    .query(async ({ input, ctx }) => {
      if (input?.tab === 'my') {
        if (!ctx.user)
          return []
        return communityService.listByUserId(ctx.user.id, input)
      }
      return communityService.listPublic(input)
    }),

  getById: publicProcedure
    .input(GetCommunityByIdInputSchema)
    .query(async ({ input }) => {
      return communityService.getById(input.id)
    }),
}
