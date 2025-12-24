import type { IMarksRepository } from '../model/types'
import type {
  CreateMarkInput,
  GetMarksParams,
  Mark,
} from '~/shared/types/models/mark'

const BASE_URL = import.meta.env.PROD
  ? 'https://realtimemap.ru' // Prod
  : '/api/rm' // Dev

export class MarksRepository implements IMarksRepository {
  private getAuthHeader(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-User-ID': '1',
      'X-User-Name': 'Test User',
      'Authorization': 'Bearer IZsBb905bqAn5W7v-y-nekD0fqp-mXnj6oLCy2eGn60',
    }

    return headers
  }

  async getMarks(params: GetMarksParams): Promise<Mark[]> {
    const response = await fetch(`${BASE_URL}/api/v2/marks/`, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    })

    return await response.json()

    // const mockMarks= [
    //   {
    //     id: 101,
    //     markName: 'Прогулка по Красной Площади',
    //     additionalInfo: 'Осмотр Кремля, ГУМа и собора Василия Блаженного. Встреча у памятника Жукову.',
    //     categoryId: 1,
    //     // GeoJSON format: [Longitude, Latitude] -> [Долгота, Широта]
    //     geom: { type: 'Point', coordinates: [37.6176, 55.7558] },
    //     startAt: new Date().toISOString(),
    //     endAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // +2 часа
    //     userId: 1,
    //   },
    //   {
    //     id: 102,
    //     markName: 'Пикник в Парке Горького',
    //     additionalInfo: 'Берем пледы, еду и бадминтон. Сбор у главного входа.',
    //     categoryId: 2,
    //     geom: { type: 'Point', coordinates: [37.601, 55.729] },
    //     startAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Вчера
    //     endAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    //     userId: 1,
    //   },
    //   {
    //     id: 103,
    //     markName: 'Кофе на Арбате',
    //     additionalInfo: 'Встреча с коллегами в кофейне, обсуждение проекта.',
    //     categoryId: 1,
    //     geom: { type: 'Point', coordinates: [37.595, 55.749] },
    //     startAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // Завтра
    //     endAt: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    //     userId: 2,
    //   },
    //   {
    //     id: 104,
    //     markName: 'Выставка на ВДНХ',
    //     additionalInfo: 'Павильон Космос, потом прогулка до ботанического сада.',
    //     categoryId: 3,
    //     geom: { type: 'Point', coordinates: [37.633, 55.828] },
    //     startAt: new Date().toISOString(),
    //     endAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    //     userId: 1,
    //   },
    //   {
    //     id: 105,
    //     markName: 'Москва-Сити смотровая',
    //     additionalInfo: 'Подъем на башню Федерация. Нужен паспорт.',
    //     categoryId: 1,
    //     geom: { type: 'Point', coordinates: [37.539, 55.747] },
    //     startAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    //     endAt: new Date(Date.now() + 1000 * 60 * 60 * 50).toISOString(),
    //     userId: 1,
    //   },
    // ] as Mark[]

    // return mockMarks
  }

  async createMark(data: CreateMarkInput): Promise<Mark> {
    const formData = new FormData()

    formData.append('markName', data.markName)
    formData.append('latitude', String(data.latitude))
    formData.append('longitude', String(data.longitude))
    formData.append('categoryId', String(data.categoryId))

    if (data.additionalInfo)
      formData.append('additionalInfo', data.additionalInfo)

    if (data.startAt)
      formData.append('startAt', data.startAt)

    if (data.duration)
      formData.append('duration', String(data.duration))

    if (data.photos && data.photos.length > 0) {
      data.photos.forEach((file) => {
        formData.append('photo', file)
      })
    }

    const response = await fetch(`${BASE_URL}/api/v2/marks/create`, {
      method: 'POST',
      body: formData,
      headers: this.getAuthHeader(),
    })

    return await response.json()
  }
}
