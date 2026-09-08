import type { ValidationScopeContext } from './types'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { normalizeFsPath } from '../lib/vault-locator'

/**
 * Проверяет, является ли папка корнем путешествия (Obsidian Travel Vault).
 * Признаки:
 * - Имя папки начинается с '-- ' (например, '-- Taiwan')
 * - Содержит файл <Название>.md (например, 'Taiwan.md' внутри '-- Taiwan')
 * - Содержит типичные подпапки ('02 - Маршрутный план', '03 - Бронирования' и т.д.)
 */
export function isTravelTripRoot(dirPath: string): boolean {
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory())
    return false

  const folderName = basename(dirPath)

  // Папки вида 01 - ..., 02 - ..., 03 - ... являются внутренними подпапками, а не корнем
  if (/^0\d\s*[-–—]/i.test(folderName))
    return false

  if (folderName.startsWith('-- ') || folderName.startsWith('— ') || folderName.startsWith('– '))
    return true

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    // Проверяем наличие файла с именем папки
    const cleanName = folderName.replace(/^[–—\-]+\s*/, '').trim()
    if (entries.some(e => e.isFile() && e.name.toLowerCase() === `${cleanName.toLowerCase()}.md`))
      return true

    // Проверяем наличие подпапки маршрутного плана (обязательно директория)
    if (entries.some(e => e.isDirectory() && /^(?:02\s*[-–—]\s*)?(?:маршрутный план|маршрут|plan|days)/i.test(e.name)))
      return true
  }
  catch {
    return false
  }

  return false
}

/**
 * Проверяет, является ли папка подпапкой маршрутного плана (с дневными файлами).
 */
export function isDaysDirectory(dirPath: string): boolean {
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory())
    return false

  const folderName = basename(dirPath)
  if (/^(?:02\s*[-–—]\s*)?(?:маршрутный план|маршрут|plan|days)/i.test(folderName))
    return true

  try {
    const files = readdirSync(dirPath).filter(f => f.endsWith('.md'))
    const dayFilesCount = files.filter(f => /^(?:\d{1,2}|day|день)/i.test(f)).length
    return dayFilesCount >= 2
  }
  catch {
    return false
  }
}

/**
 * Разрешает контекст валидации по переданному пути:
 * автоматически определяет, передан ли полный корень путешествия,
 * подпапка «02 - Маршрутный план», папка секции или конкретный файл дня.
 */
export function resolveValidationScopeContext(rawPath: string): ValidationScopeContext {
  const normalized = normalizeFsPath(rawPath)
  const resolved = resolve(normalized)

  if (!existsSync(resolved)) {
    throw new Error(`Указанный путь не существует: ${resolved}`)
  }

  const stat = statSync(resolved)

  // 1. Указан отдельный файл
  if (stat.isFile()) {
    const filePath = resolved
    const fileName = basename(filePath)
    const containingDir = dirname(filePath)
    const parentOfContaining = dirname(containingDir)

    let tripRootPath = containingDir
    let targetSubfolder: string | undefined

    if (isTravelTripRoot(parentOfContaining)) {
      tripRootPath = parentOfContaining
      targetSubfolder = basename(containingDir)
    }
    else if (isTravelTripRoot(containingDir)) {
      tripRootPath = containingDir
    }

    const isDayFile = /^(?:\d{1,2}|day|день)/i.test(fileName)

    return {
      targetPath: rawPath,
      resolvedPath: resolved,
      tripRootPath,
      scope: isDayFile ? 'single-day' : 'single-file',
      targetSubfolder,
      targetFileName: fileName,
    }
  }

  // 2. Указана директория
  const folderName = basename(resolved)
  const parentDir = dirname(resolved)

  // А. Сначала проверяем, является ли сама переданная папка корнем путешествия
  if (isTravelTripRoot(resolved)) {
    return {
      targetPath: rawPath,
      resolvedPath: resolved,
      tripRootPath: resolved,
      scope: 'full-trip',
    }
  }

  // Б. Проверяем, является ли переданная папка подпапкой путешествия (например, «02 - Маршрутный план»)
  if (isTravelTripRoot(parentDir)) {
    const isPlan = isDaysDirectory(resolved)
    return {
      targetPath: rawPath,
      resolvedPath: resolved,
      tripRootPath: parentDir,
      scope: isPlan ? 'route-plan' : 'single-section',
      targetSubfolder: folderName,
    }
  }

  // В. Проверяем, содержит ли переданная папка дневные файлы напрямую (даже без родительского вольта)
  if (isDaysDirectory(resolved)) {
    return {
      targetPath: rawPath,
      resolvedPath: resolved,
      tripRootPath: isTravelTripRoot(parentDir) ? parentDir : resolved,
      scope: 'route-plan',
      targetSubfolder: isTravelTripRoot(parentDir) ? folderName : undefined,
    }
  }

  // Г. Fallback: считаем саму директорию корнем путешествия
  return {
    targetPath: rawPath,
    resolvedPath: resolved,
    tripRootPath: resolved,
    scope: 'full-trip',
  }
}
