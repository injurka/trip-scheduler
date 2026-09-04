import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

/**
 * Утилиты для обнаружения Obsidian-хранилищ и нормализации путей.
 * Общая логика для tools/skills-installer и tools/obsidian-importer.
 */

/**
 * Нормализует путь к файловой системе:
 * 1. Срезает кавычки и конвертирует обратные слэши в прямые.
 * 2. В среде Linux/WSL преобразует пути Windows (C:/... -> /mnt/c/...).
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

/**
 * Читает официальный реестр вольтов Obsidian (~/.config/obsidian/obsidian.json
 * на Linux, %APPDATA%/obsidian/obsidian.json на Windows, ~/Library/Application Support/obsidian на macOS).
 */
export function readObsidianVaultRegistry(): string[] {
  const configDir = platform() === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian')
    : platform() === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'obsidian')
      : join(homedir(), '.config', 'obsidian')

  const registryPath = join(configDir, 'obsidian.json')
  if (!existsSync(registryPath)) {
    return []
  }

  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as {
      vaults?: Record<string, { path?: string }>
    }
    const vaults: string[] = []
    for (const entry of Object.values(registry.vaults || {})) {
      if (entry.path && isDirectory(entry.path)) {
        vaults.push(entry.path)
      }
    }
    return vaults
  }
  catch {
    return []
  }
}

/** Найдет директорию Obsidian-конфига, включая смонтированные Windows-разделы (WSL). */
function findObsidianConfigDirs(): string[] {
  const dirs: string[] = []

  if (platform() === 'linux') {
    dirs.push(join(homedir(), '.config/obsidian'))
    if (existsSync('/mnt/c/Users')) {
      try {
        for (const entry of readdirSync('/mnt/c/Users', { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            dirs.push(join('/mnt/c/Users', entry.name, 'AppData/Roaming/obsidian'))
          }
        }
      }
      catch {
        // ignore unreadable /mnt/c/Users
      }
    }
  }
  else if (platform() === 'win32') {
    dirs.push(join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian'))
  }
  else if (platform() === 'darwin') {
    dirs.push(join(homedir(), 'Library', 'Application Support', 'obsidian'))
  }

  return dirs
}

/**
 * Ищет реальные корни Obsidian-вольтов:
 * 1. Реестр obsidian.json (все известные конфиг-локации).
 * 2. Стандартные папки пользователя (~/Documents, ~/Obsidian, ...) с маркером .obsidian.
 * Возвращает только директории, реально содержащие маркер .obsidian.
 */
export function discoverVaultRoots(): string[] {
  const roots = new Set<string>()

  const addIfVault = (candidate: string): boolean => {
    if (candidate && isDirectory(join(candidate, '.obsidian'))) {
      roots.add(candidate)
      return true
    }
    return false
  }

  // 1. Официальный реестр Obsidian из всех доступных конфиг-локаций
  for (const configDir of findObsidianConfigDirs()) {
    const registryPath = join(configDir, 'obsidian.json')
    if (!existsSync(registryPath)) {
      continue
    }
    try {
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as {
        vaults?: Record<string, { path?: string }>
      }
      for (const entry of Object.values(registry.vaults || {})) {
        if (entry.path) {
          addIfVault(entry.path)
        }
      }
    }
    catch {
      // ignore malformed registry
    }
  }

  // 2. Стандартные директории пользователя с маркером .obsidian
  const standardBases = [
    join(homedir(), 'Documents'),
    join(homedir(), 'Obsidian'),
    join(homedir(), 'obsidian'),
  ]
  for (const base of standardBases) {
    if (!isDirectory(base)) {
      continue
    }
    addIfVault(base)
    try {
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          addIfVault(join(base, entry.name))
        }
      }
    }
    catch {
      // ignore unreadable dir
    }
  }

  return Array.from(roots)
}

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

export interface VaultLocation {
  /** Абсолютный путь к папке назначения внутри вольта (например, «.../Travel»). */
  path: string
  /** Корень вольта, в котором найдена папка. */
  vaultRoot: string
  /** Имя папки назначения. */
  name: string
}

/**
 * Находит целевые папки (по умолчанию Travel) в известных Obsidian-вольтах.
 * Сначала ищет подпапку с указанным именем в корне вольта, затем спускается
 * на один уровень вглубь (например, <vault>/Personal Note/Travel).
 */
export function discoverVaultFolders(targetFolderName: string = 'Travel'): VaultLocation[] {
  const lowerTarget = targetFolderName.toLowerCase()
  const found: VaultLocation[] = []
  const seen = new Set<string>()

  for (const vaultRoot of discoverVaultRoots()) {
    let entries: string[]
    try {
      entries = readdirSync(vaultRoot)
    }
    catch {
      continue
    }

    let matched = false

    // 1. Прямая подпапка корня вольта
    for (const entry of entries) {
      if (entry.toLowerCase() === lowerTarget && isDirectory(join(vaultRoot, entry))) {
        pushFound(join(vaultRoot, entry), vaultRoot)
        matched = true
      }
    }

    // 2. Спуск на один уровень: <vault>/<любая папка>/<target>
    if (!matched) {
      try {
        for (const entry of readdirSync(vaultRoot, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue
          }
          const subDir = join(vaultRoot, entry.name)
          try {
            for (const subEntry of readdirSync(subDir)) {
              if (subEntry.toLowerCase() === lowerTarget && isDirectory(join(subDir, subEntry))) {
                pushFound(join(subDir, subEntry), vaultRoot)
                matched = true
              }
            }
          }
          catch {
            // ignore unreadable subdir
          }
        }
      }
      catch {
        // ignore unreadable vault
      }
    }
  }

  return found

  function pushFound(path: string, vaultRoot: string): void {
    if (!seen.has(path)) {
      seen.add(path)
      found.push({ path, vaultRoot, name: targetFolderName })
    }
  }
}

/**
 * Возвращает существующие директории кандидатов целевой папки в вольтах,
 * включая «сырые» пути реестра (без проверки маркера .obsidian).
 * Используется как последний fallback при интерактивном выборе.
 */
export function getCandidateTravelDirs(targetFolderName: string = 'Travel'): string[] {
  const candidates: string[] = []

  const addCandidate = (base: string): void => {
    const candidate = join(base, targetFolderName)
    if (isDirectory(candidate)) {
      candidates.push(candidate)
    }
  }

  // Реестр вольтов (даже если маркера .obsidian нет)
  for (const vaultPath of readObsidianVaultRegistry()) {
    addCandidate(vaultPath)
    try {
      for (const entry of readdirSync(vaultPath, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          addCandidate(join(vaultPath, entry.name))
        }
      }
    }
    catch {
      // ignore unreadable vault
    }
  }

  // Домашние директории
  const home = homedir()
  for (const base of [
    join(home, 'Documents/obsidian-mark'),
    join(home, 'Documents'),
    join(home, 'Obsidian'),
    join(home, 'Documents/Obsidian'),
    home,
  ]) {
    addCandidate(base)
  }

  return Array.from(new Set(candidates))
}
