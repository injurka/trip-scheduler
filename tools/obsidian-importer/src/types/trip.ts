import type { ChecklistSectionContent } from './checklist'
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

export interface ParsedDay {
  dayNumber: number
  fileName: string
  filePath: string
  title: string
  description: string
  rawContent: string
  date: string
  meta: DayMetaInfo[]
}

export interface ParsedTripData {
  title: string
  description: string
  descriptionShort: string
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
}
