import type { z } from 'zod'
import type { CreateReviewInputSchema, GetUserReviewsInputSchema } from './destination-review.schemas'
import { db } from '~/../db'
import { createTRPCError } from '~/lib/trpc'
import { destinationReviewRepository } from '~/repositories/destination-review.repository'
import { geoRepository } from '~/repositories/geo.repository'

async function canonicalizeSelectedCity<T extends { countryId?: string, geoPlaceId?: string | null, city?: string | null, type?: 'city' | 'country' }>(
  data: T,
  existingPlaceId?: string | null,
): Promise<T> {
  if (data.type === 'country')
    return { ...data, geoPlaceId: null, city: null }
  if (!data.geoPlaceId)
    return data

  const [place] = await geoRepository.getByIds({ ids: [data.geoPlaceId], locale: 'ru' })
  const [selectableId] = await geoRepository.getSelectableIds([data.geoPlaceId])
  if (!place || (!selectableId && place.id !== existingPlaceId) || place.kind !== 'settlement' || (data.countryId && place.countryId !== data.countryId)) {
    throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника для выбранной страны.')
  }

  return { ...data, geoPlaceId: place.id, city: place.name }
}

export const destinationReviewService = {
  async getCountries() {
    return await db.query.countries.findMany({
      orderBy: (c, { asc }) => [asc(c.name)],
    })
  },

  async getUserReviews(input: z.infer<typeof GetUserReviewsInputSchema>) {
    return await destinationReviewRepository.getByUserId(input)
  },

  async getMapPoints(userId: string) {
    return await destinationReviewRepository.getMapPoints(userId)
  },

  async create(data: z.infer<typeof CreateReviewInputSchema>, userId: string) {
    if (data.type === 'city' && !data.geoPlaceId)
      throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника.')

    data = await canonicalizeSelectedCity(data)
    const newReview = await destinationReviewRepository.create({
      ...data,
      userId,
    } as any)

    if (!newReview) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось сохранить впечатление.')
    }
    return newReview
  },

  async update(id: string, data: Partial<z.infer<typeof CreateReviewInputSchema>>, userId: string) {
    const existing = await destinationReviewRepository.getByIdForUser(id, userId)
    if (!existing)
      throw createTRPCError('NOT_FOUND', 'Впечатление не найдено или у вас нет прав на его редактирование.')

    const targetType = data.type ?? existing.type
    if (targetType === 'city') {
      const targetPlaceId = data.geoPlaceId === undefined ? existing.geoPlaceId : data.geoPlaceId
      if (!targetPlaceId)
        throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника.')

      if (data.geoPlaceId !== undefined || data.countryId !== undefined || data.type !== undefined) {
        data.geoPlaceId = targetPlaceId
        data.countryId = data.countryId ?? existing.countryId
      }
      else {
        delete data.city
      }
    }

    data = await canonicalizeSelectedCity(data, existing.geoPlaceId)
    const updated = await destinationReviewRepository.update(id, data as any, userId)
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
