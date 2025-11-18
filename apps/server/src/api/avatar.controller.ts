import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { authUtils } from '~/lib/auth.utils'
import { userRepository } from '~/repositories/user.repository'
import { generateFilePaths, saveFile } from '~/services/file-storage.service'
import { generateImageVariants } from '~/services/image-metadata.service'
import { fileUploadsCounter, fileUploadSizeBytesHistogram } from '~/services/metrics.service'

const avatarController = new Hono()

async function uploadAvatarController(c: Context) {
  const authHeader = c.req.header('authorization')
  const token = authHeader?.split(' ')[1]
  if (!token)
    throw new HTTPException(401, { message: 'Токен аутентификации не предоставлен.' })

  const payload = await authUtils.verifyToken(token)
  if (!payload)
    throw new HTTPException(401, { message: 'Невалидный или истекший токен.' })

  const userId = payload.id

  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File))
    throw new HTTPException(400, { message: 'Файл аватара не найден в запросе.' })

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const paths = generateFilePaths(`avatars/${userId}`, 'avatar.webp')

    // Генерируем только один вариант - сам аватар
    const variants = await generateImageVariants(fileBuffer)
    const avatarBuffer = variants.medium || variants.small || await sharp(fileBuffer).resize({ width: 400 }).webp({ quality: 90 }).toBuffer()

    await saveFile(paths.original.diskPath, avatarBuffer)

    const updatedUser = await userRepository.update(userId, { avatarUrl: paths.original.dbPath })

    const placement = 'avatar'
    fileUploadsCounter.inc({ placement })
    fileUploadSizeBytesHistogram.observe({ placement }, file.size)

    return c.json(updatedUser)
  }
  catch (error) {
    console.error(`Ошибка при загрузке аватара для пользователя ${userId}:`, error)
    throw new HTTPException(500, { message: 'Внутренняя ошибка при обработке аватара.' })
  }
}

avatarController.post('/upload', uploadAvatarController)

export { avatarController }
