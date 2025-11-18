import type { tripImages } from 'db/schema'
import { mkdir, unlink } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

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
  const staticRoot = process.env.STATIC_PATH
  if (!staticRoot) {
    throw new Error('Переменная окружения STATIC_PATH должна быть установлена.')
  }

  const { base, ext } = createUniqueFilename(originalFilename)
  const filename = `${base}${ext}`

  // Пути для оригинала
  const original = {
    dbPath: join(relativeDirPath, filename),
    diskPath: join(staticRoot, relativeDirPath, filename),
  }

  /**
   * Генерирует пути для конкретного варианта.
   * @param variantName - Название варианта (e.g., 'small').
   */
  const getVariantPaths = (variantName: string) => {
    const variantFilename = `${base}-${variantName}.webp`
    return {
      dbPath: join(relativeDirPath, variantFilename),
      diskPath: join(staticRoot, relativeDirPath, variantFilename),
    }
  }

  return {
    original,
    getVariantPaths,
  }
}

/**
 * Сохраняет буфер в файл, создавая директории при необходимости.
 */
export async function saveFile(fullPath: string, fileBuffer: Buffer): Promise<void> {
  const dir = dirname(fullPath)
  await mkdir(dir, { recursive: true })
  await Bun.write(fullPath, fileBuffer)
}

/**
 * Удаляет физический файл с диска.
 * @param dbPath - Относительный путь к файлу, как он хранится в БД.
 */
async function deleteFileFromDisk(dbPath: string) {
  const staticRoot = process.env.STATIC_PATH
  if (!staticRoot) {
    console.error('Переменная окружения STATIC_PATH не установлена. Удаление файла пропущено.')
    return
  }
  try {
    const fullPath = join(process.cwd(), staticRoot, dbPath)
    await unlink(fullPath)
  }
  catch (error) {
    // Игнорируем ошибку, если файл не найден (возможно, уже удален)
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.error(`Не удалось удалить файл: ${dbPath}`, error)
    }
  }
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

  await Promise.all(filesToDelete.map(filePath => deleteFileFromDisk(filePath)))
}
