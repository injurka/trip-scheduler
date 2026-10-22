import type { z } from 'zod'
import type { CreateReviewInputSchema, GetUserReviewsInputSchema } from './destination-review.schemas'
import { db } from '~/../db'
import { createTRPCError } from '~/lib/trpc'
import { destinationReviewRepository } from '~/repositories/destination-review.repository'
import { geoRepository } from '~/repositories/geo.repository'

async function canonicalizeSelectedCity<T extends { countryId?: string, geoPlaceId?: string | null, city?: string | null, type?: 'city' | 'country' }>(data: T): Promise<T> {
  if (data.type === 'country' || (!data.geoPlaceId && !data.city?.trim()))
    return data

  let placeId = data.geoPlaceId
  if (!placeId && data.city?.trim()) {
    const resolution = await geoRepository.resolveExact({
      label: data.city,
      countryId: data.countryId,
      kinds: ['settlement'],
    })
    if (resolution.status !== 'resolved' || !resolution.place) {
      const message = resolution.status === 'needs_review'
        ? 'Название совпадает с несколькими городами. Выберите точный город из справочника.'
        : 'Город не найден в выбранной стране. Выберите город из справочника.'
      throw createTRPCError('BAD_REQUEST', message)
    }
    placeId = resolution.place.id
  }
  if (!placeId)
    return data

  const [place] = await geoRepository.getByIds({ ids: [placeId], locale: 'ru' })
  const [selectableId] = await geoRepository.getSelectableIds([placeId])
  if (!place || !selectableId || place.kind !== 'settlement' || (data.countryId && place.countryId !== data.countryId)) {
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

  async getReviewCities(userId: string) {
    return await destinationReviewRepository.getCitiesByUserId(userId)
  },

  async getMapPoints(userId: string) {
    return await destinationReviewRepository.getMapPoints(userId)
  },

  async create(data: z.infer<typeof CreateReviewInputSchema>, userId: string) {
    if (data.type === 'city' && !data.geoPlaceId && !data.city?.trim())
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

    if ((data.type ?? existing.type) === 'city'
      && data.countryId !== undefined
      && data.countryId !== existing.countryId
      && data.city === undefined
      && data.geoPlaceId === undefined) {
      data.city = existing.city
    }

    const cityUnchanged = data.geoPlaceId === undefined
      && data.city !== undefined
      && data.city === existing.city
      && (data.countryId === undefined || data.countryId === existing.countryId)
    if (cityUnchanged) {
      delete data.city
      if (data.countryId === existing.countryId)
        delete data.countryId
    }

    data = await canonicalizeSelectedCity(data)
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
