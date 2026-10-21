import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { TRIP_MEDIA_ROOT_DIR_NAMES } from '../config/paths'

/**
 * Индекс .gpx-файлов вольта: ключи — относительный путь от корня тура и basename
 * (в обоих регистрах). Пустая строка — маркер неоднозначного basename, как в
 * buildImageIndex: резолвер обязан пойти по суффиксу пути.
 */
export function buildGpxIndex(tripDir: string): Map<string, string> {
  const index = new Map<string, string>()

  function addKey(key: string, fullPath: string): void {
    const owner = index.get(key)
    index.set(key, owner !== undefined && owner !== fullPath ? '' : fullPath)
  }

  function add(root: string, fullPath: string): void {
    const relativePath = relative(root, fullPath).replace(/\\/g, '/')
    for (const key of [relativePath, relativePath.toLowerCase()])
      addKey(key, fullPath)

    const base = basename(fullPath)
    for (const key of [base, base.toLowerCase()])
      addKey(key, fullPath)
  }

  function walk(root: string, current: string): void {
    if (!existsSync(current))
      return

    try {
      const entries = readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules')
            walk(root, fullPath)
          continue
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.gpx'))
          add(root, fullPath)
      }
    }
    catch {
      // Нечитаемая директория не должна мешать индексации соседних.
    }
  }

  walk(tripDir, tripDir)

  // Медиа-корни могут лежать рядом с папкой тура (общая папка вложений вольта)
  const parentDir = dirname(tripDir)
  if (parentDir && existsSync(parentDir)) {
    for (const folder of [...TRIP_MEDIA_ROOT_DIR_NAMES, 'attachments', 'assets', 'files']) {
      const candidate = join(parentDir, folder)
      if (existsSync(candidate) && statSync(candidate).isDirectory())
        walk(candidate, candidate)
    }
  }

  return index
}
