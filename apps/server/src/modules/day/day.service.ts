import type { z } from 'zod'
import type { CreateDayInputSchema, UpdateDayInputSchema } from './day.schemas'
import { createTRPCError } from '~/lib/trpc'
import { tripRepository } from '~/modules/trip/trip.repository' // Убедитесь, что путь корректный
import { dayRepository } from './day.repository' // Импорт локального репозитория

export const dayService = {
  async getNote(dayId: string) {
    // Репозиторий вернет null, если дня нет
    return await dayRepository.getNote(dayId)
  },

  async getByTripId(id: string) {
    // В отличие от Drizzle, где возвращается один объект с массивом,
    // здесь метод репозитория возвращает массив дней.
    // Процедура ожидает массив, так что все ок.
    return await dayRepository.getByTripId(id)
  },

  async create(data: z.infer<typeof CreateDayInputSchema>, userId: string) {
    // Используем tripRepository из предыдущего шага
    const trip = await tripRepository.getById(data.tripId)

    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    // Проверка прав (trip.userId уже строка после репозитория)
    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление дня в это путешествие.')

    return await dayRepository.create(data)
  },

  async update(id: string, details: z.infer<typeof UpdateDayInputSchema>['details'], userId: string) {
    const day = await dayRepository.findByIdWithOwner(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    // day.trip подгружен через FETCH
    if (day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого дня.')

    const updatedDay = await dayRepository.update(id, details)
    if (!updatedDay)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return updatedDay
  },

  async delete(id: string, userId: string) {
    const day = await dayRepository.findByIdWithOwner(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    if (day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого дня.')

    const deletedDay = await dayRepository.delete(id)
    if (!deletedDay)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return deletedDay
  },
}
