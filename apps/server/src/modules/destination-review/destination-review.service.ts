import type { z } from 'zod'
import type { CreateReviewInputSchema, GetUserReviewsInputSchema } from './destination-review.schemas'
import { db } from '~/../db'
import { createTRPCError } from '~/lib/trpc'
import { destinationReviewRepository } from '~/repositories/destination-review.repository'

export const destinationReviewService = {
  async getCountries() {
    return await db.query.countries.findMany({
      orderBy: (c, { asc }) => [asc(c.name)],
    })
  },

  async getUserReviews(input: z.infer<typeof GetUserReviewsInputSchema>) {
    return await destinationReviewRepository.getByUserId(input.userId, input.type)
  },

  async create(data: z.infer<typeof CreateReviewInputSchema>, userId: string) {
    const newReview = await destinationReviewRepository.create({
      ...data,
      userId,
    })

    if (!newReview) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось сохранить впечатление.')
    }

    return newReview
  },

  async update(id: string, data: Partial<z.infer<typeof CreateReviewInputSchema>>, userId: string) {
    const updated = await destinationReviewRepository.update(id, data, userId)
    if (!updated) {
      throw createTRPCError('NOT_FOUND', 'Впечатление не найдено или у вас нет прав на его редактирование.')
    }
    return updated
  },

  async delete(id: string, userId: string) {
    const deleted = await destinationReviewRepository.delete(id, userId)

    if (!deleted) {
      throw createTRPCError('NOT_FOUND', 'Впечатление не найдено или у вас нет прав на его удаление.')
    }

    return { success: true }
  },
}
