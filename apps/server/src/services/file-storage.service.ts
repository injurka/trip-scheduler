import type { tripImages } from 'db/schema'
import { extname, join } from 'node:path'
import { s3Service } from './s3.service'

type TripImage = typeof tripImages.$inferSelect

/**
 * Генерирует уникальное имя файла, сохраняя исходное расширение.
 */
function createUniqueFilename(originalFilename: string): { base: string, ext: string } {
  const ext = extname(originalFilename)
  const base = `${Date.now()}-${crypto.randomUUID()}`

  return { base, ext }
}

/**
 * Генерирует пути для нового изображения и его вариантов.
 * @param relativeDirPath - Относительный путь для сохранения (e.g., 'trips/trip-id/memories').
 * @param originalFilename - Исходное имя загруженного файла.
 * @returns Объект с путями.
 */
export function generateFilePaths(
  relativeDirPath: string,
  originalFilename: string,
) {
  const { base, ext } = createUniqueFilename(originalFilename)
  const filename = `${base}${ext}`

  const path = join(relativeDirPath, filename).replace(/\\/g, '/')

  /**
   * Генерирует пути для конкретного варианта.
   * @param variantName - Название варианта (e.g., 'small').
   */
  const getVariantPaths = (variantName: string) => {
    const variantFilename = `${base}-${variantName}.webp`

    return join(relativeDirPath, variantFilename).replace(/\\/g, '/')
  }

  return {
    path,
    getVariantPaths,
  }
}

/**
 * Сохраняет буфер напрямую в S3 облако.
 * Функция принимает dbPath (относительный путь), который становится ключом (Key) в S3.
 */
export async function saveFile(dbPath: string, fileBuffer: Buffer): Promise<void> {
  let contentType = 'application/octet-stream'
  if (dbPath.endsWith('.webp'))
    contentType = 'image/webp'
  else if (dbPath.endsWith('.jpg') || dbPath.endsWith('.jpeg'))
    contentType = 'image/jpeg'
  else if (dbPath.endsWith('.png'))
    contentType = 'image/png'

  await s3Service.uploadFile(dbPath, fileBuffer, contentType)
}

/**
 * Удаляет файл. Пытается удалить из S3, и на всякий случай проверяет локальный диск
 * для плавного перехода.
 * @param dbPath - Относительный путь к файлу, как он хранится в БД.
 */
async function deleteFileFromStorage(dbPath: string) {
  await s3Service.deleteFile(dbPath)
}

/**
 * Удаляет основной файл изображения и все его варианты.
 * @param image - Объект изображения из БД.
 */
export async function deleteFileWithVariants(image: Pick<TripImage, 'url' | 'variants'>) {
  const filesToDelete: string[] = []

  if (image.url) {
    filesToDelete.push(image.url)
  }
  if (image.variants) {
    filesToDelete.push(...Object.values(image.variants))
  }

  await Promise.all(filesToDelete.map(filePath => deleteFileFromStorage(filePath)))
}
