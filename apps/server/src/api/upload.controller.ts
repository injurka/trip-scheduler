import type { Context } from 'hono'
import type { EntityType } from '~/models/image-upload'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { imageUploadService } from '~/services/image-upload.service'

export async function uploadFileController(c: Context) {
  // 1. Проверка размера (Fail fast)
  const contentLength = c.req.header('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > 25 * 1024 * 1024) {
    throw new HTTPException(413, { message: 'Файл слишком большой (максимум 25MB)' })
  }

  // 2. Аутентификация
  const authHeader = c.req.header('authorization')
  const token = authHeader?.split(' ')[1]
  if (!token)
    throw new HTTPException(401, { message: 'Токен не предоставлен.' })

  const payload = await authUtils.verifyToken(token)
  if (!payload)
    throw new HTTPException(401, { message: 'Невалидный токен.' })
  const userId = payload.id

  // 3. Парсинг FormData
  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'Файл не найден или имеет неверный формат.' })
  }

  const entityType = formData.get('entityType') as EntityType | null
  let entityId = formData.get('entityId') as string | null
  const placement = formData.get('placement') as string | null

  if (entityType === 'avatar' && !entityId) {
    entityId = userId
  }

  if (!entityType || !entityId) {
    throw new HTTPException(400, { message: 'Необходимо указать entityType и entityId.' })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 4. Делегирование в сервис
  try {
    const result = await imageUploadService.processUpload(entityType, {
      userId,
      entityId,
      file,
      buffer,
      placement,
    })

    return c.json(result.dbRecord || { url: result.url, variants: result.variants })
  }
  catch (error: any) {
    console.error(`Upload error (${entityType}):`, error)

    if (error instanceof HTTPException)
      throw error

    throw new HTTPException(500, { message: error.message || 'Внутренняя ошибка сервера.' })
  }
}
