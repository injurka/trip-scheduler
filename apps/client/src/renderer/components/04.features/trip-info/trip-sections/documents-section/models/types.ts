import type { DocumentAccess } from '~/shared/services/api/model/types'

export interface DocumentFile {
  id: string
  url: string
  originalName: string
  sizeBytes: number
  createdAt: string
  access: DocumentAccess
  folderId: string | null
}

export interface DocumentFolder {
  id: string
  name: string
}

export interface DocumentsSectionContent {
  folders: DocumentFolder[]
}
