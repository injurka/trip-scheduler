import type { z } from 'zod'
import type { CreateCommunityInputSchema, ListCommunitiesInputSchema } from '~/modules/community/community.schemas'
import { and, desc, eq, getTableColumns, ilike, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { communities, communityMembers, users } from '~/../db/schema'

export const communityRepository = {
  async create(data: z.infer<typeof CreateCommunityInputSchema>, ownerId: string) {
    const communityId = uuidv4()

    const newCommunity = await db.transaction(async (tx) => {
      const [createdCommunity] = await tx
        .insert(communities)
        .values({
          id: communityId,
          ...data,
          ownerId,
        })
        .returning()

      // Создатель автоматически становится администратором
      await tx.insert(communityMembers).values({
        communityId,
        userId: ownerId,
        role: 'admin',
      })

      return createdCommunity
    })

    return newCommunity
  },

  async findManyPublic(filters?: z.infer<typeof ListCommunitiesInputSchema>) {
    const conditions = [eq(communities.privacyType, 'public')]

    if (filters?.search) {
      conditions.push(ilike(communities.name, `%${filters.search}%`))
    }

    const results = await db
      .select({
        ...getTableColumns(communities),
        owner: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
        membersCount: sql<number>`(select count(*) from ${communityMembers} where ${communityMembers.communityId} = ${communities.id})`.as('members_count'),
      })
      .from(communities)
      .leftJoin(users, eq(communities.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(communities.createdAt))

    return results.map(r => ({
      ...r,
      owner: r.owner,
      _count: {
        members: Number(r.membersCount) || 0,
      },
    }))
  },

  async findManyByUserId(userId: string, filters?: z.infer<typeof ListCommunitiesInputSchema>) {
    const conditions = [eq(communityMembers.userId, userId)]

    if (filters?.search) {
      conditions.push(ilike(communities.name, `%${filters.search}%`))
    }

    const results = await db
      .select({
        ...getTableColumns(communities),
        owner: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
        membersCount: sql<number>`(select count(*) from ${communityMembers} where ${communityMembers.communityId} = ${communities.id})`.as('members_count'),
      })
      .from(communities)
      .innerJoin(communityMembers, eq(communities.id, communityMembers.communityId))
      .leftJoin(users, eq(communities.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(communities.createdAt))

    return results.map(r => ({
      ...r,
      owner: r.owner,
      _count: {
        members: Number(r.membersCount) || 0,
      },
    }))
  },

  async findById(id: string) {
    return await db.query.communities.findFirst({
      where: eq(communities.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })
  },
}
