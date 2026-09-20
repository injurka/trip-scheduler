import type { BookingSectionContent } from './booking'
import type { ChecklistSectionContent } from './checklist'
import type { DocumentsSectionContent, ParsedDocumentFile } from './documents'
import type { FinancesSectionContent } from './finances'
import type { ParsedNoteFile, ParsedNoteFolder } from './notes'

export interface DayMetaInfo {
  id: string
  title: string
  subtitle?: string | null
  icon?: string | null
  color?: string | null
  content?: string | null
}

export interface DayFrontmatter {
  day?: number
  date?: string
  weekday?: string
  title?: string
  location?: string
  phase?: string
  accommodation?: string
  hotel?: string
  highlight?: string
  description?: string
  tags?: string[]
  is_ready?: boolean
  isReady?: boolean
}

export interface ParsedDay {
  dayNumber: number
  fileName: string
  filePath: string
  title: string
  description: string
  rawContent: string
  date: string
  meta: DayMetaInfo[]
  location?: string
  accommodation?: string
  phase?: string
  highlight?: string
  tags?: string[]
  is_ready?: boolean
  isReady?: boolean
  frontmatter?: DayFrontmatter
}

export interface ParsedTripData {
  title: string
  description: string
  descriptionShort: string
  cover?: string
  coverImagePath?: string
  cities: string[]
  tags: string[]
  startDate: string
  endDate: string
  days: ParsedDay[]
  sectionFolders: ParsedNoteFolder[]
  rootNotes: ParsedNoteFile[]
  checklistContent: ChecklistSectionContent
  checklistFilesCount: number
  financesContent: FinancesSectionContent
  budget?: number
  currency?: string
  bookingsContent: BookingSectionContent
  documents: ParsedDocumentFile[]
  documentsContent: DocumentsSectionContent
}
