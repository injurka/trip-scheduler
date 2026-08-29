import type { Context } from 'hono'
import type { EntityType } from '~/models/image-upload'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { imageUploadService } from '~/services/image-upload.service'

export async function uploadFileController(c: Context) {
  const contentLength = c.req.header('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > 200 * 1024 * 1024) {
    throw new HTTPException(413, { message: 'Файл слишком большой (максимум 200MB)' })
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
    try {
      customMetadata = JSON.parse(customMetadataStr)
    }
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

export async function initiateMultipartUploadController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)

  if (!user) {
    throw new HTTPException(401, { message: 'Невалидный токен или пользователь не найден.' })
  }

  const body = await c.req.json()
  const { entityType, placement, fileName, fileSize, fileType } = body
  let { entityId } = body

  if (entityType === 'avatar' && !entityId) {
    entityId = user.id
  }

  if (!entityType || !entityId || !fileName || !fileSize) {
    throw new HTTPException(400, { message: 'Необходимо указать entityType, entityId, fileName и fileSize.' })
  }

  try {
    const result = await imageUploadService.initiateMultipart(entityType, {
      userId: user.id,
      userRole: user.role,
      entityId,
      placement,
      fileName,
      fileSize: Number(fileSize),
      fileType: fileType || 'application/octet-stream',
    })

    return c.json(result)
  }
  catch (error: any) {
    console.error(`Initiate multipart error (${entityType}):`, error)
    if (error instanceof HTTPException)
      throw error
    throw new HTTPException(500, { message: error.message || 'Внутренняя ошибка сервера.' })
  }
}

export async function uploadChunkController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)

  if (!user) {
    throw new HTTPException(401, { message: 'Невалидный токен или пользователь не найден.' })
  }

  const uploadId = c.req.query('uploadId')
  const key = c.req.query('key')
  const partNumber = Number(c.req.query('partNumber'))

  if (!uploadId || !key || !partNumber) {
    throw new HTTPException(400, { message: 'Необходимо указать uploadId, key и partNumber.' })
  }

  const chunkBuffer = Buffer.from(await c.req.arrayBuffer())

  try {
    const part = await imageUploadService.uploadChunk(key, uploadId, partNumber, chunkBuffer)
    return c.json(part)
  }
  catch (error: any) {
    console.error(`Upload chunk error (part ${partNumber}):`, error)
    if (error instanceof HTTPException)
      throw error
    throw new HTTPException(500, { message: error.message || 'Ошибка загрузки чанка.' })
  }
}

export async function completeMultipartUploadController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)

  if (!user) {
    throw new HTTPException(401, { message: 'Невалидный токен или пользователь не найден.' })
  }

  const body = await c.req.json()
  const { entityType, placement, uploadId, key, parts, fileName, fileSize, metadata } = body
  let { entityId } = body

  if (entityType === 'avatar' && !entityId) {
    entityId = user.id
  }

  if (!entityType || !entityId || !uploadId || !key || !parts || !fileName || !fileSize) {
    throw new HTTPException(400, { message: 'Неполные данные для завершения загрузки.' })
  }

  try {
    const result = await imageUploadService.completeMultipart(entityType, {
      userId: user.id,
      userRole: user.role,
      entityId,
      placement,
      uploadId,
      key,
      parts,
      fileName,
      fileSize: Number(fileSize),
      customMetadata: metadata,
    })

    return c.json(result.dbRecord || { url: result.url, variants: result.variants })
  }
  catch (error: any) {
    console.error(`Complete multipart error (${entityType}):`, error)
    if (error instanceof HTTPException)
      throw error
    throw new HTTPException(500, { message: error.message || 'Ошибка завершения загрузки.' })
  }
}

export async function abortMultipartUploadController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)

  if (!user) {
    throw new HTTPException(401, { message: 'Невалидный токен.' })
  }

  const body = await c.req.json()
  const { uploadId, key } = body

  if (!uploadId || !key) {
    throw new HTTPException(400, { message: 'Необходимо указать uploadId и key.' })
  }

  try {
    await imageUploadService.abortMultipart(key, uploadId)
    return c.json({ success: true })
  }
  catch (error: any) {
    console.error(`Abort multipart error:`, error)
    return c.json({ success: false })
  }
}
