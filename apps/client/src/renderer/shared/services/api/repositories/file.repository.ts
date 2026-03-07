import type { EntityType, IFileRepository } from '../model/types'
import type { ImageMetadata, TripImage, TripImagePlacement } from '~/shared/types/models/trip'
import { ofetch } from 'ofetch'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { TOKEN_KEY } from '~/shared/store/auth.store'
import { throttle } from '../lib/decorators'

export class FileRepository implements IFileRepository {
  /**
   * Загружает файл на сервер (используя FormData) с указанием типа сущности.
   */
  @throttle(500)
  async uploadFile(
    file: File,
    entityId: string,
    entityType: EntityType,
    placement?: string | null,
    timestamp?: string | null,
    comment?: string | null,
  ): Promise<TripImage> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entityId', entityId)
    formData.append('entityType', entityType)

    if (placement)
      formData.append('placement', placement)
    if (timestamp)
      formData.append('timestamp', timestamp)
    if (comment)
      formData.append('comment', comment)

    const accessToken = useStorage<string | null>(TOKEN_KEY, null)

    return ofetch<TripImage>(`${import.meta.env.VITE_APP_SERVER_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
      },
    })
  }

  /**
   * Загружает файл с отслеживанием прогресса, используя XMLHttpRequest.
   */
  uploadFileWithProgress(
    file: File,
    entityId: string,
    entityType: EntityType,
    placement: string | null,
    onProgress: (percentage: number) => void,
    signal: AbortSignal,
  ): Promise<TripImage> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      const url = `${import.meta.env.VITE_APP_SERVER_URL}/api/upload`

      xhr.open('POST', url, true)

      const accessToken = useStorage<string | null>(TOKEN_KEY, null)
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken.value}`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded * 100) / event.total)
          onProgress(percentage)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            onProgress(100)
            resolve(response as TripImage)
          }
          catch {
            reject(new Error('Не удалось обработать ответ сервера.'))
          }
        }
        else {
          let errorMessage = `Ошибка HTTP: ${xhr.status}`
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            if (errorResponse.message)
              errorMessage = errorResponse.message
          }
          catch { }
          reject(new Error(errorMessage))
        }
      }

      xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке файла.'))

      xhr.onabort = () => reject(new DOMException('Загрузка отменена', 'AbortError'))

      signal.addEventListener('abort', () => xhr.abort())

      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityId', entityId)
      formData.append('entityType', entityType)

      if (placement)
        formData.append('placement', placement)

      xhr.send(formData)
    })
  }

  @throttle(500)
  async listImages(entityId: string, entityType: EntityType, placement?: string): Promise<TripImage[]> {
    return await trpc.image.listByEntity.query({ entityId, entityType, placement }) as TripImage[]
  }

  @throttle(500)
  async listImageByTrip(tripId: string, placement: TripImagePlacement): Promise<TripImage[]> {
    return await trpc.image.listByTrip.query({ tripId, placement }) as TripImage[]
  }

  @throttle(500)
  async getAllUserFiles(): Promise<TripImage[]> {
    return await trpc.image.getAll.query() as TripImage[]
  }

  @throttle(500)
  async deleteFile(id: string): Promise<void> {
    await trpc.image.delete.mutate({ id })
  }

  @throttle(300)
  async getMetadata(id: string): Promise<ImageMetadata | null> {
    return await trpc.image.getMetadata.query({ id }) as ImageMetadata | null
  }
}
