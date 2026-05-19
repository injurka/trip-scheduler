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

  const getVariantPaths = (variantName: string) => {
    const variantFilename = `${base}-${variantName}.webp`
    return join(relativeDirPath, variantFilename).replace(/\\/g, '/')
  }

  return { path, getVariantPaths }
}

/**
 * Сохраняет буфер напрямую в S3 облако.
 * @param dbPath - относительный путь (Key в S3)
 * @param fileBuffer - буфер файла
 * @param explicitContentType - явный MIME-тип (если есть)
 */
export async function saveFile(dbPath: string, fileBuffer: Buffer, explicitContentType?: string): Promise<void> {
  let contentType = explicitContentType || 'application/octet-stream'

  // Фоллбэк, если MIME-тип не передан или передан базовый octet-stream
  if (!explicitContentType || explicitContentType === 'application/octet-stream') {
    const lowerPath = dbPath.toLowerCase()

    // Изображения
    if (lowerPath.endsWith('.webp'))
      contentType = 'image/webp'
    else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg'))
      contentType = 'image/jpeg'
    else if (lowerPath.endsWith('.png'))
      contentType = 'image/png'
    else if (lowerPath.endsWith('.gif'))
      contentType = 'image/gif'
    else if (lowerPath.endsWith('.avif'))
      contentType = 'image/avif'
    else if (lowerPath.endsWith('.pdf'))
      contentType = 'application/pdf'
    else if (lowerPath.endsWith('.doc'))
      contentType = 'application/msword'
    else if (lowerPath.endsWith('.docx'))
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (lowerPath.endsWith('.xls'))
      contentType = 'application/vnd.ms-excel'
    else if (lowerPath.endsWith('.xlsx'))
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else if (lowerPath.endsWith('.txt'))
      contentType = 'text/plain'
    else if (lowerPath.endsWith('.csv'))
      contentType = 'text/csv'
    else if (lowerPath.endsWith('.rtf'))
      contentType = 'application/rtf'
  }

  await s3Service.uploadFile(dbPath, fileBuffer, contentType)
}

/**
 * Удаляет файл из S3.
 */
async function deleteFileFromStorage(dbPath: string) {
  await s3Service.deleteFile(dbPath)
}

/**
 * Удаляет основной файл и все его варианты.
 */
export async function deleteFileWithVariants(image: Pick<TripImage, 'url' | 'variants'>) {
  const filesToDelete: string[] = []

  if (image.url)
    filesToDelete.push(image.url)
  if (image.variants)
    filesToDelete.push(...Object.values(image.variants))

  await Promise.all(filesToDelete.map(filePath => deleteFileFromStorage(filePath)))
}
