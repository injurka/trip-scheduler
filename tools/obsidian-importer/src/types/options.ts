export interface CliOptions {
  dir?: string
  apiUrl: string
  email?: string
  password?: string
  startDate?: string
  useLlm: boolean
  llmModel?: string
  dryRun: boolean
  visibility: 'private' | 'public'
  status: 'planned' | 'draft' | 'completed'
  importTripMeta?: boolean
  importDays?: boolean
  importActivities?: boolean
  importChecklists?: boolean
  importNotes?: boolean
  importSections?: boolean
  uploadImages: boolean
  geocode: boolean
  nonInteractive?: boolean
}
