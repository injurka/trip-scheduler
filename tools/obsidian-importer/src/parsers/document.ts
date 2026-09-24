import type { Dirent } from 'node:fs'
import type { DocumentCategory, DocumentFolderInfo, DocumentsSectionContent, ParsedDocumentFile } from '../types/documents'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { TRIP_MEDIA_ROOT_DIR_NAMES } from '../config/paths'
import { stableId } from '../lib/stable-id'

function matchCategory(text: string): DocumentCategory | null {
  const t = text.toLowerCase()

  if (/(?:паспорт|passport|виза|visa|\bid\b|права|водительск|driver|license|licence|удостоверение|загран|снилс|snils|омс)/iu.test(t)) {
    return 'id'
  }
  if (/(?:поезд|train|thsr|tra|shinkansen|авиа|самолет|flight|перелет|трансфер|transfer|автобус|bus|паром|ferry|аренда|прокат)/iu.test(t)) {
    return 'transport'
  }
  if (/(?:отель|гостиниц|hotel|hostel|booking|жилье|проживание|апартамент|airbnb|чек-ин|check-in)/iu.test(t)) {
    return 'lodging'
  }
  if (/(?:страхов|insurance|полис|медицин|медиц|medical)/iu.test(t)) {
    return 'insurance'
  }
  if (/(?:билет|ticket|boarding|посадочн|маршрут-квитанция|квитанция|receipt|voucher|ваучер|купон|coupon|пропуск|\bpass\b|талон|confirmation|itinerary)/iu.test(t)) {
    return 'tickets'
  }

  return null
}

/**
 * Определение категории документа по имени файла или названию подпапки.
 */
export function detectDocumentCategory(fileName: string, folderName?: string | null): DocumentCategory {
  const fromFile = matchCategory(fileName)
  if (fromFile) {
    return fromFile
  }

  if (folderName) {
    const fromFolder = matchCategory(folderName)
    if (fromFolder) {
      return fromFolder
    }
  }

  return 'other'
}

function getDirectoryDefaultAccess(name: string): 'private' | 'public' | null {
  if (/(?:private[_-]?doc|личные[_-]?док|приватные[_-]?док)/iu.test(name)) {
    return 'private'
  }
  if (/(?:public[_-]?doc|общие[_-]?док|публичные[_-]?док)/iu.test(name)) {
    return 'public'
  }
  if (/(?:^documents$|^документы$)/iu.test(name)) {
    return 'public'
  }
  return null
}

/**
 * Сканирует директорию путешествия на наличие папок с документами.
 * Канонический корень: `00 - Файлы и документы/`; `_` остается legacy-алиасом.
 * Внутри обоих корней поддерживаются PrivateDocument(s)/PublicDocument(s),
 * а также соответствующие русские и корневые варианты.
 */
export function parseObsidianDocuments(tripRootPath: string): {
  documents: ParsedDocumentFile[]
  documentsContent: DocumentsSectionContent
} {
  const documents: ParsedDocumentFile[] = []
  const foldersMap = new Map<string, DocumentFolderInfo>()
  const visitedPaths = new Set<string>()

  if (!existsSync(tripRootPath)) {
    return { documents, documentsContent: { folders: [] } }
  }

  const candidateDirs: Array<{ path: string, defaultAccess: 'private' | 'public' }> = []

  function addCandidate(dirPath: string, access: 'private' | 'public') {
    if (!candidateDirs.some(c => c.path === dirPath) && existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      candidateDirs.push({ path: dirPath, defaultAccess: access })
    }
  }

  // 0. Если передан прямой путь к папке документов (например, 00 - Файлы и документы/PrivateDocuments)
  const directSelfAccess = getDirectoryDefaultAccess(basename(tripRootPath))
  if (directSelfAccess) {
    addCandidate(tripRootPath, directSelfAccess)
  }

  // 1. Проверяем канонический и legacy-корни вложений.
  for (const mediaRootName of TRIP_MEDIA_ROOT_DIR_NAMES) {
    const mediaRootDir = join(tripRootPath, mediaRootName)
    if (existsSync(mediaRootDir) && statSync(mediaRootDir).isDirectory()) {
      try {
        const mediaRootEntries = readdirSync(mediaRootDir, { withFileTypes: true })
        for (const entry of mediaRootEntries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const access = getDirectoryDefaultAccess(entry.name)
            if (access) {
              addCandidate(join(mediaRootDir, entry.name), access)
            }
          }
        }
      }
      catch {
        // ignore
      }
    }
  }

  // 2. Проверяем в корне папки путешествия
  try {
    const rootEntries = readdirSync(tripRootPath, { withFileTypes: true })
    for (const entry of rootEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const access = getDirectoryDefaultAccess(entry.name)
        if (access) {
          addCandidate(join(tripRootPath, entry.name), access)
        }
      }
    }
  }
  catch {
    // ignore
  }

  // 3. Прямая проверка известных путей по умолчанию
  const mediaRootDefaults: Array<{ path: string, access: 'private' | 'public' }> = TRIP_MEDIA_ROOT_DIR_NAMES.flatMap(mediaRootName => [
    { path: join(tripRootPath, mediaRootName, 'PrivateDocuments'), access: 'private' },
    { path: join(tripRootPath, mediaRootName, 'PrivateDocument'), access: 'private' },
    { path: join(tripRootPath, mediaRootName, 'Личные документы'), access: 'private' },
    { path: join(tripRootPath, mediaRootName, 'PublicDocuments'), access: 'public' },
    { path: join(tripRootPath, mediaRootName, 'PublicDocument'), access: 'public' },
    { path: join(tripRootPath, mediaRootName, 'Общие документы'), access: 'public' },
    { path: join(tripRootPath, mediaRootName, 'Documents'), access: 'public' },
    { path: join(tripRootPath, mediaRootName, 'Документы'), access: 'public' },
  ])

  const directDefaults: Array<{ path: string, access: 'private' | 'public' }> = [
    ...mediaRootDefaults,
    { path: join(tripRootPath, 'PrivateDocuments'), access: 'private' },
    { path: join(tripRootPath, 'PrivateDocument'), access: 'private' },
    { path: join(tripRootPath, 'Личные документы'), access: 'private' },
    { path: join(tripRootPath, 'PublicDocuments'), access: 'public' },
    { path: join(tripRootPath, 'PublicDocument'), access: 'public' },
    { path: join(tripRootPath, 'Общие документы'), access: 'public' },
    { path: join(tripRootPath, 'Documents'), access: 'public' },
    { path: join(tripRootPath, 'Документы'), access: 'public' },
  ]

  for (const item of directDefaults) {
    addCandidate(item.path, item.access)
  }

  // Обход найденных директорий с документами
  for (const { path: dir, defaultAccess } of candidateDirs) {
    scanDocumentDirectory(dir, null, defaultAccess)
  }

  function scanDocumentDirectory(dirPath: string, parentFolderName: string | null, currentAccess: 'private' | 'public') {
    let entries: Dirent[]
    try {
      entries = readdirSync(dirPath, { withFileTypes: true })
    }
    catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'Thumbs.db' || entry.name.endsWith('.tmp')) {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subName = entry.name
        const isAccessScope = /^(?:private|личные|приватные|public|общие|публичные)$/iu.test(subName)
        if (isAccessScope) {
          const scopeAccess: 'private' | 'public' = /^(?:private|личные|приватные)$/iu.test(subName) ? 'private' : 'public'
          scanDocumentDirectory(fullPath, parentFolderName, scopeAccess)
        }
        else {
          const folderName = entry.name
          if (!foldersMap.has(folderName)) {
            foldersMap.set(folderName, {
              id: stableId('doc-folder', folderName.trim().toLowerCase()),
              name: folderName,
            })
          }
          scanDocumentDirectory(fullPath, folderName, currentAccess)
        }
      }
      else if (entry.isFile()) {
        if (visitedPaths.has(fullPath)) {
          continue
        }
        visitedPaths.add(fullPath)

        let sizeBytes = 0
        try {
          sizeBytes = statSync(fullPath).size
        }
        catch {
          // ignore
        }

        const fileName = entry.name
        const title = fileName.replace(/\.[^/.]+$/, '')
        const category = detectDocumentCategory(fileName, parentFolderName)

        documents.push({
          title,
          fileName,
          filePath: fullPath,
          folderName: parentFolderName,
          category,
          access: currentAccess,
          sizeBytes,
        })
      }
    }
  }

  const folders = Array.from(foldersMap.values())

  return {
    documents,
    documentsContent: {
      folders,
    },
  }
}
