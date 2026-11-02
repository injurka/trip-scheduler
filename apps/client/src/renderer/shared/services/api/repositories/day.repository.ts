import type { IDayRepository } from '../model/types'
import type { Day } from '~/shared/types/models/activity'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'
import { normalizeDay } from '../lib/normalize-models'

class DayRepository implements IDayRepository {
  /**
   * Получает все дни для конкретного путешествия.
   * @param tripId - Уникальный идентификатор путешествия.
   * @returns Promise<Day[]> - Массив дней.
   */
  @throttle(1_000)
  async getByTripId(tripId: string): Promise<Day[]> {
    return (await trpc.day.getByTripId.query({ tripId })).map(normalizeDay)
  }

  /**
   * Получает заметку для дня.
   */
  async getNote(params: { dayId: string }): Promise<string | null> {
    return await trpc.day.getNote.query(params)
  }

  /**
   * Создает новый день через tRPC мутацию.
   * @param dayData - Данные нового дня.
   * @returns Promise<Day> - Созданный день с ID от сервера.
   */
  @throttle(1_000)
  async createNewDay(dayData: Omit<Day, 'id' | 'activities'>): Promise<Day> {
    const newDay = await trpc.day.create.mutate(dayData)

    return normalizeDay(newDay)
  }

  @throttle(1_000)
  async deleteDay(id: string): Promise<Day> {
    const deletedDay = await trpc.day.delete.mutate({ id })

    return normalizeDay(deletedDay)
  }

  @throttle(1_000)
  async updateDayDetails(id: string, details: Partial<Pick<Day, 'title' | 'description' | 'date' | 'meta' | 'note'>>): Promise<Day> {
    const result = await trpc.day.update.mutate({
      id,
      details,
    })

    return normalizeDay(result)
  }
}

export { DayRepository }
