import type { EntityType, IFileRepository, TripDocumentResponse } from '../model/types'
import type { ImageMetadata, TripMedia, TripMediaPlacement } from '~/shared/types/models/trip'
import { ofetch } from 'ofetch'
import { SERVER_URL } from '~/shared/lib/env'
import { refreshTokensIfNeeded } from '~/shared/services/trpc/auth-token.service'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { TOKEN_KEY, useAuthStore } from '~/shared/store/auth.store'
import { throttle } from '../lib/decorators'

export class FileRepository implements IFileRepository {
  /**
   * Загружает файл на сервер (используя FormData) с указанием типа сущности.
   */
  async uploadFile(
    file: File,
    entityId: string,
    entityType: EntityType,
    placement?: string | null,
    timestamp?: string | null,
    comment?: string | null,
    metadata?: Record<string, any>,
  ): Promise<TripMedia> {
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
    if (metadata)
      formData.append('metadata', JSON.stringify(metadata))

    const authStore = useAuthStore()
    let accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)

    try {
      return await ofetch<TripMedia>(`${SERVER_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }
    catch (err: any) {
      if (err.status === 401 || err.statusCode === 401 || err.response?.status === 401) {
        const refreshed = await refreshTokensIfNeeded()
        if (refreshed) {
          accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)
          return await ofetch<TripMedia>(`${SERVER_URL}/api/upload`, {
            method: 'POST',
            body: formData,
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        }
      }
      throw err
    }
  }

  /**
   * Загружает большой файл (или видео) по частям (Multipart Upload),
   * что исключает OOM на сервере и позволяет безопасно грузить файлы до 10GB.
   */
  private async uploadMultipartWithProgress(
    file: File,
    entityId: string,
    entityType: EntityType,
    placement: string | null,
    onProgress: (percentage: number) => void,
    signal: AbortSignal,
  ): Promise<TripMedia> {
    const serverUrl = SERVER_URL
    const accessToken = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // 1. Инициализация составной загрузки
    const initRes = await ofetch<{ uploadId: string, key: string, chunkSize: number }>(
      `${serverUrl}/api/upload/multipart/initiate`,
      {
        method: 'POST',
        headers,
        body: {
          entityType,
          entityId,
          placement,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
        },
      },
    )

    const { uploadId, key, chunkSize } = initRes
    const totalParts = Math.ceil(file.size / chunkSize)
    const completedParts: { PartNumber: number, ETag: string }[] = []

    try {
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (signal.aborted) {
          throw new DOMException('Загрузка отменена', 'AbortError')
        }

        const start = (partNumber - 1) * chunkSize
        const end = Math.min(file.size, start + chunkSize)
        const chunk = file.slice(start, end)

        const partResult = await new Promise<{ partNumber: number, eTag: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          const chunkUrl = `${serverUrl}/api/upload/multipart/chunk?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`

          xhr.open('PUT', chunkUrl, true)
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
          xhr.setRequestHeader('Content-Type', 'application/octet-stream')

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const uploadedSoFar = start + event.loaded
              const percentage = Math.min(99, Math.round((uploadedSoFar * 100) / file.size))
              onProgress(percentage)
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText)
                resolve(res)
              }
              catch {
                reject(new Error('Не удалось прочитать ответ сервера для части загрузки.'))
              }
            }
            else {
              reject(new Error(`Ошибка загрузки чанка #${partNumber}: HTTP ${xhr.status}`))
            }
          }

          xhr.onerror = () => reject(new Error(`Сетевая ошибка при загрузке чанка #${partNumber}`))
          xhr.onabort = () => reject(new DOMException('Загрузка отменена', 'AbortError'))

          const onAbortSignal = () => xhr.abort()
          signal.addEventListener('abort', onAbortSignal, { once: true })

          xhr.send(chunk)
        })

        completedParts.push({
          PartNumber: partResult.partNumber,
          ETag: partResult.eTag,
        })
      }

      // 2. Завершение составной загрузки
      const completeRes = await ofetch<TripMedia>(`${serverUrl}/api/upload/multipart/complete`, {
        method: 'POST',
        headers,
        body: {
          entityType,
          entityId,
          placement,
          uploadId,
          key,
          parts: completedParts,
          fileName: file.name,
          fileSize: file.size,
        },
      })

      onProgress(100)
      return completeRes
    }
    catch (err: any) {
      try {
        await ofetch(`${serverUrl}/api/upload/multipart/abort`, {
          method: 'POST',
          headers,
          body: { uploadId, key },
        })
      }
      catch { }
      throw err
    }
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
  ): Promise<TripMedia> {
    if (file.size > 20 * 1024 * 1024 || file.type.startsWith('video/')) {
      return this.uploadMultipartWithProgress(file, entityId, entityType, placement, onProgress, signal)
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${SERVER_URL}/api/upload`

      xhr.open('POST', url, true)

      const accessToken = localStorage.getItem(TOKEN_KEY)
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)

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
            resolve(response as TripMedia)
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
  async listImages(entityId: string, entityType: EntityType, placement?: string): Promise<TripMedia[]> {
    return await trpc.image.listByEntity.query({ entityId, entityType, placement }) as TripMedia[]
  }

  @throttle(500)
  async listImageByTrip(tripId: string, placement: TripMediaPlacement): Promise<TripMedia[]> {
    return await trpc.image.listByTrip.query({ tripId, placement }) as TripMedia[]
  }

  @throttle(500)
  async getAllUserFiles(): Promise<TripMedia[]> {
    return await trpc.image.getAll.query() as TripMedia[]
  }

  @throttle(500)
  async deleteFile(id: string): Promise<void> {
    await trpc.image.delete.mutate({ id })
  }

  @throttle(300)
  async getMetadata(id: string): Promise<ImageMetadata | null> {
    return await trpc.image.getMetadata.query({ id }) as ImageMetadata | null
  }

  @throttle(500)
  async listDocuments(tripId: string): Promise<TripDocumentResponse[]> {
    const result = await trpc.image.listDocuments.query({ tripId })
    return result as unknown as TripDocumentResponse[]
  }

  @throttle(500)
  async updateDocumentMeta(
    id: string,
    metadata: { access?: 'public' | 'private', folderId?: string | null },
  ): Promise<TripDocumentResponse> {
    const result = await trpc.image.updateDocumentMeta.mutate({ id, metadata })
    return result as unknown as TripDocumentResponse
  }
}
