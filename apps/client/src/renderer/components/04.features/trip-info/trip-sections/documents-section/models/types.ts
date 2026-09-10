import type { DocumentAccess } from '~/shared/services/api/model/types'

export type DocumentCategory = 'all' | 'tickets' | 'lodging' | 'transport' | 'id' | 'insurance' | 'other'

export interface DocumentCategoryMeta {
  id: DocumentCategory
  label: string
  icon: string
  color: string
}

export interface DocumentFile {
  id: string
  url: string
  originalName: string
  sizeBytes: number
  createdAt: string
  access: DocumentAccess
  folderId: string | null
  title?: string | null
  category?: DocumentCategory | null
  isFavorite?: boolean
  note?: string | null
}

export interface DocumentFolder {
  id: string
  name: string
  color?: string
  icon?: string
}

export interface DocumentsSectionContent {
  folders: DocumentFolder[]
}

export type DocumentSortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc'
export type DocumentViewMode = 'grid' | 'list'
