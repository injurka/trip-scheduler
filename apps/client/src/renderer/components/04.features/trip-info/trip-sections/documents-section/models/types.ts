import type { TripImage } from '~/shared/types/models/trip'

export type DocumentAccess = 'public' | 'private'

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
