import type { Context } from 'hono'
import type { EntityType } from '~/models/image-upload'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { imageUploadService } from '~/services/image-upload.service'

export async function uploadFileController(c: Context) {
  const contentLength = c.req.header('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > 35 * 1024 * 1024) {
    throw new HTTPException(413, { message: 'Файл слишком большой (максимум 35MB)' })
  }

  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)

  if (!user) {
    throw new HTTPException(401, { message: 'Невалидный токен или пользователь не найден.' })
  }

  const { id: userId, role: userRole } = user

  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'Файл не найден или имеет неверный формат.' })
  }

  const entityType = formData.get('entityType') as EntityType | null
  let entityId = formData.get('entityId') as string | null
  const placement = formData.get('placement') as string | null

  const customMetadataStr = formData.get('metadata') as string | null
  let customMetadata: Record<string, any> | undefined
  if (customMetadataStr) {
    try { customMetadata = JSON.parse(customMetadataStr) }
    catch { }
  }

  if (entityType === 'avatar' && !entityId) {
    entityId = userId
  }

  if (!entityType || !entityId) {
    throw new HTTPException(400, { message: 'Необходимо указать entityType и entityId.' })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await imageUploadService.processUpload(entityType, {
      userId,
      userRole,
      entityId,
      file,
      buffer,
      placement,
      customMetadata,
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
