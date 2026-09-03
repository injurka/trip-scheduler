import { homedir, platform } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

/**
 * Нормализует путь к файловой системе:
 * 1. Конвертирует обратные слэши в прямые.
 * 2. В среде Linux/WSL автоматически преобразует пути Windows (C:\... -> /mnt/c/...).
 * 3. Разворачивает тильду (~) в домашнюю директорию пользователя.
 * 4. Преобразует относительные пути в абсолютные.
 */
export function normalizeFsPath(rawPath: string): string {
  if (!rawPath)
    return rawPath

  let p = rawPath.trim()

  // Удаляем кавычки, если путь был передан с ними
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith('\'') && p.endsWith('\''))) {
    p = p.slice(1, -1).trim()
  }

  // Конвертируем Windows обратные слэши
  p = p.replace(/\\/g, '/')

  // Если это Linux/WSL и передан диск Windows вида C:/...
  if (platform() === 'linux') {
    const winDriveMatch = p.match(/^([a-z]):\/(.*)$/i)
    if (winDriveMatch) {
      const driveLetter = winDriveMatch[1].toLowerCase()
      const rest = winDriveMatch[2]
      p = `/mnt/${driveLetter}/${rest}`
    }
  }

  // Разворачиваем домашнюю директорию ~
  if (p.startsWith('~/') || p === '~') {
    p = p.replace(/^~(?=$|\/)/, homedir())
  }

  // Делаем абсолютным
  if (!isAbsolute(p)) {
    p = resolve(process.cwd(), p)
  }

  return p
}
