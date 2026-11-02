import type { BookingSectionContent, ChecklistSectionContent, DocumentsSectionContent, FinancesSectionContent } from '../types'
import type { DocumentFolderInfo } from '../types/documents'
import { isRecord } from './value-guards'

export type ImportSectionContent = Partial<BookingSectionContent & ChecklistSectionContent & DocumentsSectionContent & FinancesSectionContent>

export function readDocumentFolders(content: unknown): DocumentFolderInfo[] {
  if (!isRecord(content) || !Array.isArray(content.folders))
    return []
  return content.folders.filter((folder): folder is DocumentFolderInfo =>
    isRecord(folder) && typeof folder.id === 'string' && typeof folder.name === 'string')
}
