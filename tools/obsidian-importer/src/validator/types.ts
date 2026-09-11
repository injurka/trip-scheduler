export type ValidationSeverity = 'error' | 'warning' | 'info'

export type ValidationCategory
  = | 'structure'
    | 'hub'
    | 'days'
    | 'timeline'
    | 'locations'
    | 'media'
    | 'bookings'
    | 'finances'
    | 'checklists'

export interface ValidationIssue {
  severity: ValidationSeverity
  category: ValidationCategory
  file?: string
  line?: number
  rawText?: string
  message: string
  recommendation?: string
}

export interface UnparsedActivityCandidate {
  line: number
  rawLine: string
  reason: string
  suggestedFix: string
}

export interface ValidatedActivitySummary {
  startTime: string
  endTime: string
  title: string
  tag: string
  hasLocations: boolean
  hasIframe: boolean
  imagesCount: number
  notesCount: number
}

export interface DayValidationSummary {
  dayNumber: number
  fileName: string
  filePath: string
  title: string
  description: string
  date: string
  metaCount: number
  activitiesCount: number
  activities: ValidatedActivitySummary[]
  unparsedCandidates: UnparsedActivityCandidate[]
  imagesReferenced: string[]
  missingImages: string[]
  locationsCount: number
  hasIframe: boolean
  hasFinances: boolean
  financesTotal?: string
  issues: ValidationIssue[]
}

export interface ValidationScopeContext {
  targetPath: string
  resolvedPath: string
  tripRootPath: string
  scope: 'full-trip' | 'route-plan' | 'single-day' | 'single-section' | 'single-file'
  targetSubfolder?: string
  targetFileName?: string
}

export interface ValidationReport {
  context: ValidationScopeContext
  tripTitle: string
  descriptionShort: string
  description: string
  cities: string[]
  tags: string[]
  dates: {
    startDate: string
    endDate: string
    durationDays: number
  }
  days: DayValidationSummary[]
  totalActivities: number
  totalImagesReferenced: number
  totalImagesMissing: number
  totalLocations: number
  bookingsSummary: {
    hotelsCount: number
    flightsCount: number
    trainsCount: number
    carsCount: number
    attractionsCount: number
    othersCount: number
    totalBookings: number
  }
  financesSummary: {
    categoriesCount: number
    transactionsCount: number
    totalRub: number
  }
  checklistsSummary: {
    tabsCount: number
    groupsCount: number
    tasksCount: number
    tasksWithCost: number
    tasksWithLocation: number
    tasksWithLink: number
  }
  notesSummary: {
    foldersCount: number
    filesCount: number
  }
  issues: ValidationIssue[]
  score: number // 0-100%
  status: 'excellent' | 'good' | 'needs-attention' | 'critical'
  readinessSummary: {
    canImport: boolean
    tripMetaReady: boolean
    daysReady: boolean
    activitiesReady: boolean
    bookingsReady: boolean
    financesReady: boolean
    checklistsReady: boolean
  }
}
