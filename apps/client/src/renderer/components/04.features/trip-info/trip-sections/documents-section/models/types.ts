import type { TripImage } from '~/shared/types/models/trip'

export type DocumentAccess = 'public' | 'private'

// Используем TripImage, так как он уже содержит большинство необходимых полей.
// Добавляем access и folderId.
export interface DocumentFile extends TripImage {
  access: DocumentAccess
  folderId: string | null
}

export interface DocumentFolder {
  id: string
  name: string
}

export interface DocumentsSectionContent {
  documents: DocumentFile[]
  folders: DocumentFolder[]
}
