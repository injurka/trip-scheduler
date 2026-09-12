export type DocumentCategory = 'all' | 'tickets' | 'lodging' | 'transport' | 'id' | 'insurance' | 'other'

export interface ParsedDocumentFile {
  title: string
  fileName: string
  filePath: string
  folderName: string | null
  category: DocumentCategory
  access: 'private' | 'public'
  sizeBytes: number
}

export interface DocumentFolderInfo {
  id: string
  name: string
  color?: string
  icon?: string
}

export interface DocumentsSectionContent {
  folders: DocumentFolderInfo[]
}
