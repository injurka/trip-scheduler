import { mkdir, unlink } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

function createUniqueFilename(originalFilename: string): { base: string, ext: string } {
  const ext = extname(originalFilename)
  const base = `${Date.now()}-${crypto.randomUUID()}`
  return { base, ext }
}

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

  const original = {
    dbPath: join(relativeDirPath, filename),
    diskPath: join(staticRoot, relativeDirPath, filename),
  }

  const getVariantPaths = (variantName: string) => {
    const variantFilename = `${base}-${variantName}.webp`
    return {
      dbPath: join(relativeDirPath, variantFilename),
      diskPath: join(staticRoot, relativeDirPath, variantFilename),
    }
  }

  return { original, getVariantPaths }
}

export async function saveFile(fullPath: string, fileBuffer: Buffer): Promise<void> {
  const dir = dirname(fullPath)
  await mkdir(dir, { recursive: true })
  await Bun.write(fullPath, fileBuffer)
}

async function deleteFileFromDisk(dbPath: string) {
  const staticRoot = process.env.STATIC_PATH
  if (!staticRoot)
    return
  try {
    const fullPath = join(process.cwd(), staticRoot, dbPath)
    await unlink(fullPath)
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.error(`Не удалось удалить файл: ${dbPath}`, error)
    }
  }
}

export async function deleteFileWithVariants(image: Pick<TripImage, 'url' | 'variants'>) {
  const filesToDelete: string[] = []

  if (image.url) {
    filesToDelete.push(image.url)
  }
  if (image.variants) {
    // values returns unknown[] by default in some TS configs, asserting string
    filesToDelete.push(...Object.values(image.variants) as string[])
  }

  await Promise.all(filesToDelete.map(filePath => deleteFileFromDisk(filePath)))
}
