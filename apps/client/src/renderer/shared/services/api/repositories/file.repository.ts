import type { IFileRepository } from '../model/types'
import type { TripImage, TripImagePlacement } from '~/shared/types/models/trip'
import { ofetch } from 'ofetch'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { TOKEN_KEY } from '~/shared/store/auth.store'
import { throttle } from '../lib/decorators'

export class FileRepository implements IFileRepository {
  /**
   * Загружает файл на сервер (используя FormData).
   * Этот метод остается без изменений.
   */
  @throttle(500)
  async uploadFile(file: File, tripId: string, placement: TripImagePlacement, timestamp?: string | null, comment?: string | null): Promise<TripImage> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tripId', tripId)
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
   * Загружает файл с отслеживанием прогресса, используя XMLHttpRequest для надежности.
   */
  uploadFileWithProgress(
    file: File,
    tripId: string,
    placement: TripImagePlacement,
    onProgress: (percentage: number) => void,
    signal: AbortSignal,
  ): Promise<TripImage> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${import.meta.env.VITE_APP_SERVER_URL}/api/upload?tripId=${tripId}&placement=${placement}`
      xhr.open('POST', url, true)

      // Установка необходимых заголовков
      const accessToken = useStorage<string | null>(TOKEN_KEY, null)
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken.value}`)
      xhr.setRequestHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
      // Content-Type и Content-Length браузер установит сам для объекта File

      // Обработчик прогресса загрузки
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded * 100) / event.total)
          onProgress(percentage)
        }
      }

      // Обработчик успешного завершения запроса
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            onProgress(100) // Гарантируем, что прогресс дойдет до 100%
            resolve(response as TripImage)
          }
          catch {
            reject(new Error('Не удалось обработать ответ сервера.'))
          }
        }
        else {
          // Попытка извлечь сообщение об ошибке от сервера
          let errorMessage = `Ошибка HTTP: ${xhr.status}`
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            if (errorResponse.message)
              errorMessage = errorResponse.message
          }
          catch {
            // Игнорируем ошибку парсинга, используем стандартное сообщение
          }
          reject(new Error(errorMessage))
        }
      }

      // Обработчики ошибок и отмены
      xhr.onerror = () => {
        reject(new Error('Сетевая ошибка при загрузке файла.'))
      }

      xhr.onabort = () => {
        // Ошибки AbortError обрабатываются в сторе Pinia особым образом
        reject(new DOMException('Загрузка отменена', 'AbortError'))
      }

      // Интеграция с AbortSignal для отмены извне
      signal.addEventListener('abort', () => {
        xhr.abort()
      })

      // Отправка файла
      xhr.send(file)
    })
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
}
