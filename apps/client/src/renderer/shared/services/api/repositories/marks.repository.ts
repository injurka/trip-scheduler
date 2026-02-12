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
