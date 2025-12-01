import type { Context } from 'hono'
import type { ImageMetadata } from '~/repositories/image.repository'
import { tripImagePlacementEnum } from 'db/schema'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { authUtils } from '~/lib/auth.utils'
import { imageService } from '~/modules/image/image.service'
import { tripRepository } from '~/repositories/trip.repository'
import { userRepository } from '~/repositories/user.repository'
import { generateFilePaths, saveFile } from '~/services/file-storage.service'
import { extractAndStructureMetadata, generateImageVariants } from '~/services/image-metadata.service'
import { fileUploadsCounter, fileUploadSizeBytesHistogram } from '~/services/metrics.service'
import { quotaService } from '~/services/quota.service'

/**
 * Извлекает имя файла из заголовка Content-Disposition.
 */
function getFileNameFromHeader(header: string | null): string | null {
  if (!header)
    return null
  const match = header.match(/filename="([^"]+)"/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function uploadFileController(c: Context) {
  const authHeader = c.req.header('authorization')
  const token = authHeader?.split(' ')[1]
  if (!token)
    throw new HTTPException(401, { message: 'Токен аутентификации не предоставлен.' })

  const payload = await authUtils.verifyToken(token)
  if (!payload)
    throw new HTTPException(401, { message: 'Невалидный или истекший токен.' })
  const userId = payload.id

  // 1. Получаем данные из FormData (так как клиент шлет multipart/form-data)
  const formData = await c.req.formData()

  const tripId = formData.get('tripId') as string
  const placement = formData.get('placement') as string
  const file = formData.get('file')

  // 2. Валидация полей
  if (!tripId)
    throw new HTTPException(400, { message: 'Необходимо указать ID путешествия (tripId).' })

  if (!placement || !tripImagePlacementEnum.enumValues.includes(placement as 'route' | 'memories'))
    throw new HTTPException(400, { message: 'Необходимо указать корректный тип размещения (placement).' })

  if (!file || !(file instanceof File))
    throw new HTTPException(400, { message: 'Файл не найден в теле запроса или имеет неверный формат.' })

  const fileName = file.name ?? getFileNameFromHeader(c.req.header('content-disposition')!)
  const fileBuffer = await file.arrayBuffer()

  const trip = await tripRepository.getById(tripId)
  if (!trip)
    throw new HTTPException(404, { message: 'Путешествие не найдено.' })

  if (trip.userId !== userId)
    throw new HTTPException(403, { message: 'У вас нет прав на загрузку файлов в это путешествие.' })

  try {
    // 3. Подготовка данных (преобразуем ArrayBuffer в Buffer для Node.js/Sharp)
    const buffer = Buffer.from(fileBuffer)

    await quotaService.checkStorageQuota(userId, buffer.length)
    const paths = generateFilePaths(`trips/${tripId}/${placement}`, fileName)

    // 4. Извлечение метаданных
    let metadata, imageVariants
    try {
      ({ metadata } = await extractAndStructureMetadata(buffer))
      imageVariants = await generateImageVariants(buffer)
    }
    catch (sharpError: any) {
      console.error('Sharp processing error:', sharpError)
      throw new HTTPException(415, { message: `Неподдерживаемый формат изображения: ${sharpError.message}` })
    }

    // 5. Генерация и сохранение вариантов
    const variantUrls: Record<string, string> = {}
    let variantsTotalSize = 0

    await Promise.all(
      Object.entries(imageVariants).map(async ([name, variantBuffer]) => {
        const variantPaths = paths.getVariantPaths(name)
        await saveFile(variantPaths.diskPath, variantBuffer)
        variantUrls[name] = variantPaths.dbPath
        variantsTotalSize += variantBuffer.length
      }),
    )

    // 6. Сохранение основного файла
    await saveFile(paths.original.diskPath, buffer)

    // 7. Сохранение записи в БД
    const totalSize = buffer.length + variantsTotalSize
    const newImageRecord = await imageService.create(
      tripId,
      paths.original.dbPath,
      fileName,
      placement as 'route' | 'memories',
      totalSize,
      {
        ...metadata,
        variants: variantUrls,
      } as ImageMetadata,
    )

    await quotaService.incrementStorageUsage(userId, totalSize)

    fileUploadsCounter.inc({ placement })
    fileUploadSizeBytesHistogram.observe({ placement }, buffer.length)

    // 8. Отправка ответа
    return c.json(newImageRecord)
  }
  catch (error: any) {
    console.error('Ошибка при обработке загруженного файла:', error)

    if (error instanceof HTTPException)
      throw error

    if (error.message.includes('Input buffer')) {
      return c.json(
        { message: 'Ошибка обработки изображения. Возможно, файл поврежден.' },
        415,
      )
    }

    return c.json(
      { message: error.message || 'Внутренняя ошибка при обработке файла.' },
      500,
    )
  }
}

export async function uploadAvatarController(c: Context) {
  const authHeader = c.req.header('authorization')
  const token = authHeader?.split(' ')[1]
  if (!token)
    throw new HTTPException(401, { message: 'Токен не предоставлен.' })

  const payload = await authUtils.verifyToken(token)
  if (!payload)
    throw new HTTPException(401, { message: 'Невалидный токен.' })

  const userId = payload.id
  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File))
    throw new HTTPException(400, { message: 'Файл аватара не найден.' })

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const paths = generateFilePaths(`avatars/${userId}`, file.name)

    const avatarBuffer = await sharp(fileBuffer).resize(200, 200).webp({ quality: 85 }).toBuffer()
    await saveFile(paths.original.diskPath, avatarBuffer)

    const updatedUser = await userRepository.update(userId, { avatarUrl: paths.original.dbPath })

    return c.json(updatedUser)
  }
  catch (error: any) {
    console.error('Ошибка при загрузке аватара:', error)

    if (error instanceof HTTPException)
      throw error

    return c.json(
      { message: error.message || 'Не удалось загрузить аватар.' },
      500,
    )
  }
}
