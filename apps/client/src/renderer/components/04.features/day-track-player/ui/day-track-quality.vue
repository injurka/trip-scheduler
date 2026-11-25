<script setup lang="ts">
import type {
  ActivityCorrection,
  ActivityType,
  recordingQuality,
  TrackGeometryAction,
  TrackQualityIssue,
} from '@limiteddissolve/track-processing'
import type { DayPoint } from '../models/types'
import { Icon } from '@iconify/vue'
import { hasCoherentTrackGeometry, haversineM, inspectTrackGeometry, trackGeometryContextMs } from '@limiteddissolve/track-processing'
import { computed, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { upperTimeIndex } from '../lib/track-time-window'
import { ACTIVITY_LABELS } from '../models/types'

export interface QualityAnalysis {
  action: TrackGeometryAction | null
  reason: string
  affectedFixes: number
  excludedTimestamps?: number[]
  suggestedActivity?: ActivityType | null
}
export interface QualityProposal {
  issue: TrackQualityIssue
  action?: TrackGeometryAction | null
  excludedTimestamps?: number[]
  suggestedActivity?: ActivityType | null
}
type IssueFilter = 'todo' | 'done' | 'gaps'
type BadgeVariant = 'is-applied' | 'is-clean' | 'is-ready' | 'is-live'
interface EnrichedIssueItem {
  issue: TrackQualityIssue
  category: 'glitch' | 'activity' | 'gap'
  correction?: ActivityCorrection
  pendingSync: boolean
  recordingNow: boolean
  tooLong: boolean
  resolved: boolean
  autoAction?: TrackGeometryAction
  suggestion?: QualityAnalysis
  effectiveProposal?: QualityProposal
  metaDetail: string
  badge?: string
  badgeClass?: BadgeVariant
  title: string
  subtitle: string
}
interface Props {
  quality: ReturnType<typeof recordingQuality>
  summaryOnly?: boolean
  rawPoints?: DayPoint[]
  timeZone?: string
  corrections?: ActivityCorrection[]
  isLiveDay?: boolean
  draftCount?: number
  analyze?: (issue: TrackQualityIssue) => Promise<QualityAnalysis>
  preview?: (issue: TrackQualityIssue, action: TrackGeometryAction) => Promise<void>
  previewBatch?: (proposals: QualityProposal[]) => Promise<void>
  batchCapacity?: number
}
interface SubtitleContext {
  hasGeomCorrection: boolean
  hasAnyCorrection: boolean
  pendingSync: boolean
  recordingNow: boolean
  tooLong: boolean
  suggestion?: QualityAnalysis
  autoAction?: TrackGeometryAction
  isUnknownActivityIssue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ seek: [issue: TrackQualityIssue], review: [] }>()
const results = defineModel<Record<string, QualityAnalysis>>('results', { default: () => ({}) })

const actionLabels: Record<TrackGeometryAction, string> = {
  'exclude-spike': 'Убрать скачок GPS',
  'collapse-drift': 'Сгладить дрейф на остановке',
  'smooth-drift': 'Выровнять зигзаг маршрута',
  'exclude-manual': 'Исключить точки-выбросы',
}
const autoActionTitles: Record<TrackGeometryAction, string> = {
  'exclude-spike': 'Скачок GPS в сторону',
  'collapse-drift': 'Ложный разброс на стоянке',
  'smooth-drift': 'Зигзаг при слабом сигнале',
  'exclude-manual': 'Точки-выбросы GPS',
}
const maxReviewDurationMs = 300_000
const liveRecordingRecentWindowMs = 5 * 60_000
const issueLimit = ref(30)
const selectedFilter = ref<IssueFilter>('todo')
const selectedIssue = shallowRef<TrackQualityIssue>()
const busy = ref(false)
const batchAiProgress = ref<{ done: number, total: number } | null>(null)
const batchAiSummary = ref('')
const analysisError = ref('')
const batchError = ref('')

const pointsBySession = computed(() => {
  const sessions = new Map<string, DayPoint[]>()

  for (const point of props.rawPoints ?? []) {
    const points = sessions.get(point.sessionId) ?? []
    points.push(point)
    sessions.set(point.sessionId, points)
  }

  for (const points of sessions.values())
    points.sort((a, b) => a.tsUtc - b.tsUtc)

  return sessions
})
const liveRecordingCutoffTs = computed(() => {
  if (!props.isLiveDay || !props.rawPoints?.length)
    return 0

  let latestTs = 0

  for (const p of props.rawPoints) {
    if (p.tsUtc > latestTs)
      latestTs = p.tsUtc
  }

  if (Date.now() - latestTs > liveRecordingRecentWindowMs)
    return 0

  return latestTs - trackGeometryContextMs
})
const groupedAccuracyAndGapIssues = computed(() => {
  const groups: TrackQualityIssue[] = []
  const lastBySession = new Map<string, TrackQualityIssue>()

  for (const issue of props.quality.issues) {
    const previous = lastBySession.get(issue.sessionId)

    if (canMergeAccuracyIssues(issue, previous)) {
      previous!.endedAt = Math.max(previous!.endedAt, issue.endedAt)
      previous!.points += issue.points
    }
    else {
      const group = { ...issue }
      groups.push(group)
      lastBySession.set(issue.sessionId, group)
    }
  }

  return groups
})
const unknownActivityIssues = computed<TrackQualityIssue[]>(() => {
  if (!props.rawPoints?.length)
    return []

  const found: TrackQualityIssue[] = []

  for (const [sessionId, pts] of pointsBySession.value)
    found.push(...collectSessionUnknownRuns(sessionId, pts, groupedAccuracyAndGapIssues.value))

  return found
})
const enrichedIssues = computed<EnrichedIssueItem[]>(() => {
  const hasRaw = Boolean(props.rawPoints?.length)
  const unknownSet = new Set(unknownActivityIssues.value)
  const allCandidates = [...groupedAccuracyAndGapIssues.value, ...unknownActivityIssues.value]
  const items: EnrichedIssueItem[] = []

  for (const issue of allCandidates) {
    const sessionPts = pointsBySession.value.get(issue.sessionId) ?? []
    const item = issue.kind === 'pause'
      ? enrichPauseIssue(issue, sessionPts, hasRaw)
      : enrichGlitchOrActivityIssue(
          issue,
          sessionPts,
          hasRaw,
          unknownSet.has(issue),
        )

    if (item)
      items.push(item)
  }

  return items.sort(compareEnrichedIssues)
})
const inaccurateGroupsCount = computed(() =>
  enrichedIssues.value.filter(item => item.category === 'glitch').length)
const unresolvedItems = computed(() =>
  enrichedIssues.value.filter(item => item.category !== 'gap' && !item.resolved))
const resolvedItems = computed(() =>
  enrichedIssues.value.filter(item => item.category !== 'gap' && item.resolved))
const gapItems = computed(() =>
  enrichedIssues.value.filter(item => item.category === 'gap'))
const readyProposals = computed<QualityProposal[]>(() => {
  const cap = Math.max(0, props.batchCapacity ?? 200)
  const list: QualityProposal[] = []
  let used = 0

  for (const item of unresolvedItems.value) {
    const proposal = item.effectiveProposal
    const weight = proposal ? proposalWeight(proposal) : 0

    if (proposal && weight > 0 && used + weight <= cap) {
      list.push(proposal)
      used += weight
    }
  }

  return list
})
const aiEligibleItems = computed(() =>
  unresolvedItems.value.filter(canItemUseAi))
const filters = computed(() => ([
  { id: 'todo' as const, label: 'К проверке', count: unresolvedItems.value.length },
  { id: 'done' as const, label: 'Проверено', count: resolvedItems.value.length },
  { id: 'gaps' as const, label: 'Паузы', count: gapItems.value.length },
]).filter(tab => tab.count > 0))
const activeFilter = computed<IssueFilter>(() => {
  if (filters.value.some(f => f.id === selectedFilter.value))
    return selectedFilter.value

  return filters.value[0]?.id ?? 'todo'
})
const filteredIssues = computed(() => {
  if (activeFilter.value === 'done')
    return resolvedItems.value

  if (activeFilter.value === 'gaps')
    return gapItems.value

  return unresolvedItems.value
})
const visibleIssues = computed(() => filteredIssues.value.slice(0, issueLimit.value))
const showActionBar = computed(() =>
  Boolean(batchAiProgress.value
    || batchAiSummary.value
    || batchError.value
    || (activeFilter.value === 'todo' && ((props.analyze && aiEligibleItems.value.length) || (props.previewBatch && readyProposals.value.length)))))

watch(activeFilter, () => {
  issueLimit.value = 30
})
watch(enrichedIssues, () => {
  selectedIssue.value = undefined
  analysisError.value = ''
  batchError.value = ''
})

function canMergeAccuracyIssues(issue: TrackQualityIssue, previous: TrackQualityIssue | undefined): boolean {
  return issue.kind === 'accuracy'
    && previous?.kind === 'accuracy'
    && issue.startedAt - previous.endedAt <= 20_000
    && issue.endedAt - previous.startedAt <= maxReviewDurationMs
}
function isUnknownRunPoint(p: DayPoint | undefined): boolean {
  return Boolean(p && p.activity === 'unknown' && p.activitySource !== 'manual')
}
function buildUnknownRunIssue(
  sessionId: string,
  first: DayPoint,
  last: DayPoint,
  count: number,
  existing: TrackQualityIssue[],
): TrackQualityIssue | null {
  const dur = last.tsUtc - first.tsUtc
  const dist = haversineM(
    first.lat,
    first.lng,
    last.lat,
    last.lng,
  )

  if (dur < 15_000 || dur > maxReviewDurationMs || dist < 35)
    return null

  const overlaps = existing.some(g =>
    g.sessionId === sessionId && g.kind === 'accuracy' && g.startedAt <= last.tsUtc && g.endedAt >= first.tsUtc)

  return overlaps
    ? null
    : {
        kind: 'accuracy',
        sessionId,
        startedAt: first.tsUtc,
        endedAt: last.tsUtc,
        points: count,
      }
}
function collectSessionUnknownRuns(sessionId: string, pts: DayPoint[], existing: TrackQualityIssue[]): TrackQualityIssue[] {
  const found: TrackQualityIssue[] = []
  let runStart = -1

  for (let i = 0; i <= pts.length; i++) {
    if (isUnknownRunPoint(pts[i])) {
      if (runStart < 0)
        runStart = i

      continue
    }

    if (runStart < 0)
      continue

    const candidate = buildUnknownRunIssue(
      sessionId,
      pts[runStart]!,
      pts[i - 1]!,
      i - runStart,
      existing,
    )

    if (candidate)
      found.push(candidate)

    runStart = -1
  }

  return found
}
function enrichPauseIssue(issue: TrackQualityIssue, sessionPts: DayPoint[], hasRaw: boolean): EnrichedIssueItem | null {
  let gapDist: number | undefined

  if (hasRaw) {
    const pFrom = sessionPts.find(p => p.tsUtc === issue.startedAt)
    const pTo = sessionPts.find(p => p.tsUtc === issue.endedAt)

    if (pFrom && pTo) {
      gapDist = Math.round(haversineM(
        pFrom.lat,
        pFrom.lng,
        pTo.lat,
        pTo.lng,
      ))

      if (gapDist <= 45)
        return null
    }
  }

  const durText = duration(issue.endedAt - issue.startedAt)
  const metaDetail = gapDist !== undefined ? `${durText} · ${formatMeters(gapDist)}` : durText

  return {
    issue,
    category: 'gap',
    pendingSync: false,
    recordingNow: false,
    tooLong: false,
    resolved: false,
    metaDetail,
    title: 'Пауза в записи',
    subtitle: gapDist !== undefined
      ? `Смещение ${formatMeters(gapDist)} за ${durText} без промежуточных точек — путь между замерами неизвестен.`
      : `Пауза ${durText} без промежуточных точек — путь между замерами неизвестен.`,
  }
}
function describeGlitchTitle(isUnknownActivityIssue: boolean, autoAction?: TrackGeometryAction): string {
  if (isUnknownActivityIssue)
    return 'Неясен тип транспорта'

  if (autoAction)
    return autoActionTitles[autoAction]

  return 'Спорный участок GPS'
}
function describeBlockedSubtitle(options: SubtitleContext): string | undefined {
  if (options.hasGeomCorrection || options.hasAnyCorrection)
    return 'Правка для этого участка применена.'

  if (options.pendingSync)
    return 'Дождитесь синхронизации точек с сервером для проверки участка.'

  if (options.recordingNow)
    return 'Участок ещё записывается в реальном времени — проверка станет доступна через пару минут.'

  if (options.tooLong)
    return 'Участок длиннее 5 минут — при необходимости поправьте его вручную в редакторе движения.'

  return undefined
}
function describeAutoActionSubtitle(autoAction: TrackGeometryAction): string {
  if (autoAction === 'exclude-spike')
    return 'Резкий выброс координат в сторону между точными замерами.'

  if (autoAction === 'collapse-drift')
    return 'Хаотичный разброс точек во время остановки при слабом сигнале.'

  return 'Точки со сниженной точностью отклоняются от линии движения.'
}
function describeGlitchSubtitle(options: SubtitleContext): string {
  const blockedText = describeBlockedSubtitle(options)

  if (blockedText)
    return blockedText

  if (options.suggestion)
    return options.suggestion.reason

  if (options.autoAction)
    return describeAutoActionSubtitle(options.autoAction)

  return options.isUnknownActivityIssue
    ? 'Тип передвижения не определён автоматически — ИИ уточнит его по скорости и соседним сегментам.'
    : 'Траектория при слабом сигнале спутников — проверьте с ИИ, чтобы убрать выбросы.'
}
function resolveBadge(options: {
  hasCorrection: boolean
  suggestion?: QualityAnalysis
  effectiveProposal?: QualityProposal
  pendingSync: boolean
  recordingNow: boolean
}): { badge?: string, badgeClass?: BadgeVariant } {
  if (options.hasCorrection)
    return { badge: 'Исправлено', badgeClass: 'is-applied' }

  if (options.pendingSync)
    return { badge: 'Синхронизация…', badgeClass: 'is-live' }

  if (options.recordingNow)
    return { badge: 'Идёт запись…', badgeClass: 'is-live' }

  if (options.effectiveProposal)
    return { badge: 'Готово', badgeClass: 'is-ready' }

  if (options.suggestion)
    return { badge: 'В норме', badgeClass: 'is-clean' }

  return {}
}
function maxIssueAccuracy(context: DayPoint[], issue: TrackQualityIssue): number | undefined {
  let maxAcc = 0

  for (const p of context) {
    if (p.tsUtc >= issue.startedAt && p.tsUtc <= issue.endedAt)
      maxAcc = Math.max(maxAcc, Math.round(p.accuracy ?? 0))
  }

  return maxAcc > 0 ? maxAcc : undefined
}
function formatGlitchMeta(pointsCount: number, maxAcc?: number): string {
  const parts: string[] = []

  if (pointsCount > 0)
    parts.push(`${pointsCount} точ.`)

  if (maxAcc)
    parts.push(`±${maxAcc} м`)

  return parts.join(' · ')
}
function detectAutoGeometryAction(context: DayPoint[], issue: TrackQualityIssue, enabled: boolean): TrackGeometryAction | undefined {
  return enabled ? inspectTrackGeometry(context, issue.startedAt, issue.endedAt)?.action : undefined
}
function shouldSkipCoherentGlitch(
  context: DayPoint[],
  issue: TrackQualityIssue,
  hasRaw: boolean,
  isUnknownActivityIssue: boolean,
): boolean {
  return !isUnknownActivityIssue && hasRaw && hasCoherentTrackGeometry(context, issue.startedAt, issue.endedAt)
}
function isIssueBlocked(pendingSync: boolean, recordingNow: boolean, tooLong: boolean): boolean {
  return pendingSync || recordingNow || tooLong
}
function computeIssueResolved(savedCorr: ActivityCorrection | undefined, suggestion: QualityAnalysis | undefined, effectiveProposal: QualityProposal | undefined): boolean {
  if (savedCorr)
    return true

  return Boolean(suggestion && !effectiveProposal)
}
function enrichGlitchOrActivityIssue(
  issue: TrackQualityIssue,
  sessionPts: DayPoint[],
  hasRaw: boolean,
  isUnknownActivityIssue: boolean,
): EnrichedIssueItem | null {
  const startIdx = upperTimeIndex(sessionPts, issue.startedAt - trackGeometryContextMs - 1)
  const endIdx = upperTimeIndex(sessionPts, issue.endedAt + trackGeometryContextMs)
  const context = sessionPts.slice(startIdx, endIdx)

  if (shouldSkipCoherentGlitch(
    context,
    issue,
    hasRaw,
    isUnknownActivityIssue,
  )) {
    return null
  }

  const pendingSync = context.some(p => p.localPending)
  const recordingNow = liveRecordingCutoffTs.value > 0 && issue.endedAt >= liveRecordingCutoffTs.value
  const tooLong = issue.endedAt - issue.startedAt > maxReviewDurationMs
  const blocked = isIssueBlocked(pendingSync, recordingNow, tooLong)
  const geomCorrection = geometryCorrectionFor(issue)
  const savedCorr = geomCorrection ?? correctionFor(issue)
  const autoAction = detectAutoGeometryAction(context, issue, !blocked && hasRaw && !isUnknownActivityIssue)
  const suggestion = results.value[issueKey(issue)]
  const effectiveProposal = blocked
    ? undefined
    : buildEffectiveProposal(
        issue,
        autoAction,
        suggestion,
        Boolean(savedCorr),
      )
  const resolved = computeIssueResolved(savedCorr, suggestion, effectiveProposal)
  const maxAcc = maxIssueAccuracy(context, issue)
  const badgeInfo = resolveBadge({
    hasCorrection: Boolean(savedCorr),
    suggestion,
    effectiveProposal,
    pendingSync,
    recordingNow,
  })

  return {
    issue,
    category: isUnknownActivityIssue ? 'activity' : 'glitch',
    correction: savedCorr,
    pendingSync,
    recordingNow,
    tooLong,
    resolved,
    autoAction,
    suggestion,
    effectiveProposal,
    metaDetail: formatGlitchMeta(issue.points, maxAcc),
    ...badgeInfo,
    title: describeGlitchTitle(isUnknownActivityIssue, autoAction),
    subtitle: describeGlitchSubtitle({
      hasGeomCorrection: Boolean(geomCorrection),
      hasAnyCorrection: Boolean(savedCorr),
      pendingSync,
      recordingNow,
      tooLong,
      suggestion,
      autoAction,
      isUnknownActivityIssue,
    }),
  }
}
function compareEnrichedIssues(a: EnrichedIssueItem, b: EnrichedIssueItem): number {
  const rank = (item: EnrichedIssueItem) => item.effectiveProposal ? 3 : !item.resolved && item.category !== 'gap' ? 2 : 1

  return rank(b) - rank(a)
    || a.issue.startedAt - b.issue.startedAt
}
function canItemUseAi(item: EnrichedIssueItem): boolean {
  return item.category !== 'gap'
    && !item.resolved
    && !item.pendingSync
    && !item.recordingNow
    && !item.tooLong
    && !results.value[issueKey(item.issue)]
}
function hasRowAction(item: EnrichedIssueItem): boolean {
  if (item.effectiveProposal && (props.preview || props.previewBatch))
    return true

  return Boolean(props.analyze && canItemUseAi(item))
}
function proposalWeight(proposal: QualityProposal): number {
  const geomWeight = proposal.action === 'exclude-manual'
    ? (proposal.excludedTimestamps?.length ?? 0)
    : proposal.action ? 1 : 0

  return geomWeight + (proposal.suggestedActivity ? 1 : 0)
}
function correctionFor(issue: TrackQualityIssue) {
  return props.corrections?.find(c => c.sessionId === issue.sessionId
    && c.startedAt <= issue.endedAt && c.endedAt >= issue.startedAt
    && (issue.kind === 'accuracy' ? Boolean(c.geometryAction || c.activity !== 'unknown') : Boolean(c.geometryAction)))
}
function geometryCorrectionFor(issue: TrackQualityIssue) {
  return props.corrections?.find(c => c.geometryAction && c.sessionId === issue.sessionId
    && c.startedAt <= issue.endedAt && c.endedAt >= issue.startedAt)
}
function normalizeSuggestedActivity(activity?: ActivityType | null): ActivityType | undefined {
  return activity && activity !== 'unknown' ? activity : undefined
}
function normalizeSuggestionAction(suggestion: QualityAnalysis): TrackGeometryAction | null {
  if (suggestion.action === 'exclude-manual')
    return suggestion.excludedTimestamps?.length ? 'exclude-manual' : null

  return suggestion.action
}
function buildSuggestionProposal(issue: TrackQualityIssue, suggestion: QualityAnalysis): QualityProposal | undefined {
  const action = normalizeSuggestionAction(suggestion)
  const suggestedActivity = normalizeSuggestedActivity(suggestion.suggestedActivity)

  if (!action && !suggestedActivity)
    return undefined

  return {
    issue,
    action,
    excludedTimestamps: action === 'exclude-manual' ? suggestion.excludedTimestamps : undefined,
    suggestedActivity,
  }
}
function buildEffectiveProposal(
  issue: TrackQualityIssue,
  autoAction: TrackGeometryAction | undefined,
  suggestion: QualityAnalysis | undefined,
  hasSavedCorrection: boolean,
): QualityProposal | undefined {
  if (hasSavedCorrection)
    return undefined

  if (suggestion)
    return buildSuggestionProposal(issue, suggestion)

  return autoAction ? { issue, action: autoAction } : undefined
}
function formatProposalSummary(proposal: QualityProposal): string {
  const parts: string[] = []

  if (proposal.action === 'exclude-manual' && proposal.excludedTimestamps?.length) {
    parts.push(`Исключить выбросы (${proposal.excludedTimestamps.length} точ.)`)
  }
  else if (proposal.action) {
    parts.push(actionLabels[proposal.action])
  }

  if (proposal.suggestedActivity && proposal.suggestedActivity !== 'unknown') {
    parts.push(`Транспорт: ${ACTIVITY_LABELS[proposal.suggestedActivity] ?? proposal.suggestedActivity}`)
  }

  return parts.join(' · ')
}
function issueKey(issue: TrackQualityIssue) {
  return `${issue.sessionId}:${issue.kind}:${issue.startedAt}:${issue.endedAt}`
}
async function analyzeSingleIssue(item: EnrichedIssueItem) {
  if (!props.analyze || busy.value || !canItemUseAi(item))
    return

  selectedIssue.value = item.issue
  analysisError.value = ''
  batchAiSummary.value = ''
  busy.value = true

  try {
    const result = await props.analyze(item.issue)
    results.value = { ...results.value, [issueKey(item.issue)]: result }
  }
  catch (error) {
    analysisError.value = error instanceof Error ? error.message : 'Не удалось проверить участок с ИИ.'
  }
  finally {
    busy.value = false
  }
}
async function analyzeTargetsBatch(targets: EnrichedIssueItem[]): Promise<number> {
  const nextResults = { ...results.value }
  let failed = 0

  for (const item of targets) {
    try {
      nextResults[issueKey(item.issue)] = await props.analyze!(item.issue)
      results.value = { ...nextResults }
    }
    catch (err) {
      failed++

      if (targets.length === 1)
        throw err
    }
    finally {
      if (batchAiProgress.value)
        batchAiProgress.value = { done: batchAiProgress.value.done + 1, total: targets.length }
    }
  }

  return failed
}
async function finishSmartAiNormalization(failed: number, total: number) {
  if (readyProposals.value.length > 0 && props.previewBatch) {
    await applyProposalsPreview(readyProposals.value)

    return
  }

  if (failed > 0 && failed === total) {
    batchError.value = 'Не удалось выполнить проверку ИИ. Попробуйте позже.'

    return
  }

  batchAiSummary.value = 'Проверка завершена: спорные участки согласуются с маршрутом, правки не нужны.'
}
async function runSmartAiNormalization() {
  if (!props.analyze || busy.value)
    return

  const targets = aiEligibleItems.value.slice(0, 12)

  if (!targets.length) {
    if (readyProposals.value.length && props.previewBatch)
      await applyProposalsPreview(readyProposals.value)

    return
  }

  busy.value = true
  batchError.value = ''
  analysisError.value = ''
  batchAiSummary.value = ''
  batchAiProgress.value = { done: 0, total: targets.length }

  try {
    const failed = await analyzeTargetsBatch(targets)
    batchAiProgress.value = null
    busy.value = false
    await finishSmartAiNormalization(failed, targets.length)
  }
  catch (error) {
    batchError.value = error instanceof Error ? error.message : 'Не удалось выполнить проверку с ИИ.'
  }
  finally {
    batchAiProgress.value = null
    busy.value = false
  }
}
async function applyProposalsPreview(proposals: QualityProposal[]) {
  if (!props.previewBatch || !proposals.length || busy.value)
    return

  busy.value = true
  batchError.value = ''

  try {
    await props.previewBatch(proposals)
  }
  catch (error) {
    batchError.value = error instanceof Error ? error.message : 'Не удалось подготовить правки.'
  }
  finally {
    busy.value = false
  }
}
async function runDirectActionPreview(issue: TrackQualityIssue, action: TrackGeometryAction) {
  if (!props.preview)
    return

  selectedIssue.value = issue
  busy.value = true
  analysisError.value = ''

  try {
    await props.preview(issue, action)
  }
  catch (error) {
    analysisError.value = error instanceof Error ? error.message : 'Не удалось подготовить правку.'
  }
  finally {
    busy.value = false
  }
}
async function applySingleItemPreview(item: EnrichedIssueItem) {
  const proposal = item.effectiveProposal

  if (!proposal || busy.value)
    return

  const needsBatch = proposal.action === 'exclude-manual' || Boolean(proposal.suggestedActivity)

  if (props.previewBatch && needsBatch) {
    await applyProposalsPreview([proposal])

    return
  }

  if (props.preview && proposal.action) {
    await runDirectActionPreview(item.issue, proposal.action)

    return
  }

  if (props.previewBatch)
    await applyProposalsPreview([proposal])
}
function formatMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} км` : `${m} м`
}
function duration(ms: number) {
  const mins = Math.round(ms / 60000)

  return mins > 0 ? `${mins} мин` : `${Math.max(1, Math.round(ms / 1000))} с`
}
function time(ts: number, timeZone?: string) {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
function timeRange(issue: TrackQualityIssue, timeZone?: string) {
  return issue.startedAt === issue.endedAt
    ? time(issue.startedAt, timeZone)
    : `${time(issue.startedAt, timeZone)}–${time(issue.endedAt, timeZone)}`
}
</script>

<template>
  <section v-if="summaryOnly" class="track-quality">
    <dl>
      <div>
        <dt>Паузы в записи</dt>
        <dd>
          {{ quality.gapCount }} · {{ duration(quality.gapDurationMs) }} ·
          {{ quality.gapPercent.toFixed(1) }}%
        </dd>
      </div>
      <div>
        <dt>Сбои точности GPS</dt>
        <dd>
          {{ rawPoints?.length ? inaccurateGroupsCount : quality.inaccurateSections }} ·
          {{ duration(quality.inaccurateDurationMs) }} ·
          {{ quality.inaccuratePercent.toFixed(1) }}%
        </dd>
      </div>
      <div v-if="quality.unknownAccuracyPoints > 0">
        <dt>Без данных о точности</dt>
        <dd>{{ quality.unknownAccuracyPoints }} точек</dd>
      </div>
      <div>
        <dt>Сохранённые правки</dt>
        <dd>{{ quality.manualCorrections }}</dd>
      </div>
    </dl>
    <p>
      Пауза — промежуток сверх обычной частоты записи (от 30–75 с); потеря GPS не подтверждена.
    </p>

    <KitBtn
      v-if="unresolvedItems.length"
      size="sm"
      variant="tonal"
      color="primary"
      class="quality-full-btn"
      @click="emit('review')"
    >
      Проверить участки · {{ unresolvedItems.length }}
    </KitBtn>
    <div v-else-if="(draftCount ?? 0) > 0" class="quality-summary-banner is-draft">
      <span>Правки на предпросмотре ({{ draftCount }}) — нажмите «Применить» внизу карты.</span>
      <KitBtn size="xs" variant="text" @click="emit('review')">
        Список участков
      </KitBtn>
    </div>
    <div v-else-if="enrichedIssues.length" class="quality-summary-banner is-clean">
      <span>Спорных участков, требующих правки, нет.</span>
      <KitBtn size="xs" variant="text" @click="emit('review')">
        Журнал · {{ enrichedIssues.length }}
      </KitBtn>
    </div>
    <p v-else class="quality-clean-note">
      Маршрут записан без сбоев.
    </p>

    <slot />
  </section>

  <section v-else class="track-quality">
    <nav v-if="filters.length > 1" class="quality-segmented" aria-label="Разделы участков">
      <button
        v-for="tab in filters"
        :key="tab.id"
        type="button"
        class="segmented-tab"
        :class="{ 'is-active': tab.id === activeFilter }"
        :aria-pressed="tab.id === activeFilter"
        @click="selectedFilter = tab.id"
      >
        <span>{{ tab.label }}</span>
        <span class="segmented-count">{{ tab.count }}</span>
      </button>
    </nav>

    <div v-if="showActionBar" class="quality-action-bar">
      <template v-if="batchAiProgress">
        <div class="progress-header" role="status" aria-live="polite">
          <span class="progress-title">
            <span class="inline-spinner" aria-hidden="true" />
            ИИ проверяет спорные участки…
          </span>
          <span class="progress-counter">{{ batchAiProgress.done }} / {{ batchAiProgress.total }}</span>
        </div>
        <progress
          class="quality-progress"
          :value="batchAiProgress.done"
          :max="batchAiProgress.total"
        />
      </template>

      <template v-else-if="activeFilter === 'todo' && ((analyze && aiEligibleItems.length) || (previewBatch && readyProposals.length))">
        <p class="action-bar-caption">
          <template v-if="analyze && aiEligibleItems.length">
            ИИ проверит траекторию, отберёт GPS-выбросы и уточнит транспорт, затем покажет результат на карте.
          </template>
          <template v-else>
            Найдено готовых правок: {{ readyProposals.length }}. Сравните маршрут «До» и «После» перед сохранением.
          </template>
        </p>

        <div class="action-bar-buttons">
          <KitBtn
            v-if="analyze && aiEligibleItems.length"
            size="sm"
            color="primary"
            class="quality-full-btn"
            :disabled="busy"
            @click="runSmartAiNormalization"
          >
            <Icon icon="mdi:sparkles" />
            Проверить все с ИИ · {{ Math.min(12, aiEligibleItems.length) }}
          </KitBtn>

          <KitBtn
            v-if="previewBatch && readyProposals.length"
            size="sm"
            :variant="analyze && aiEligibleItems.length ? 'tonal' : 'solid'"
            color="primary"
            class="quality-full-btn"
            :disabled="busy"
            @click="applyProposalsPreview(readyProposals)"
          >
            <Icon icon="mdi:eye-check-outline" />
            Предпросмотр правок · {{ readyProposals.length }}
          </KitBtn>
        </div>
      </template>

      <p v-if="batchAiSummary" class="quality-hero-status" role="status">
        {{ batchAiSummary }}
      </p>
      <p v-if="batchError" class="quality-error-text" role="alert">
        {{ batchError }}
      </p>
    </div>

    <div v-if="!enrichedIssues.length" class="quality-empty-state">
      <Icon icon="mdi:check-circle-outline" class="empty-icon" />
      <strong>Маршрут в порядке</strong>
      <p>Записанные точки согласуются с траекторией движения. Правка не требуется.</p>
    </div>

    <div v-else class="quality-issues">
      <article
        v-for="item in visibleIssues"
        :key="issueKey(item.issue)"
        class="quality-issue"
        :class="{ 'is-ready': Boolean(item.effectiveProposal), 'is-resolved': item.resolved }"
      >
        <div class="quality-issue-header">
          <button
            class="quality-issue-link"
            type="button"
            title="Перейти к участку на карте"
            @click="emit('seek', item.issue)"
          >
            <span class="quality-issue-meta">
              {{ timeRange(item.issue, timeZone) }}
              <template v-if="item.metaDetail"> · {{ item.metaDetail }}</template>
            </span>
            <strong class="quality-issue-title">{{ item.title }}</strong>
          </button>

          <div class="quality-issue-side">
            <span v-if="item.badge" class="quality-status-chip" :class="item.badgeClass">
              {{ item.badge }}
            </span>
            <button
              type="button"
              class="quality-seek-btn"
              title="Показать на карте"
              aria-label="Показать на карте"
              @click="emit('seek', item.issue)"
            >
              <Icon icon="mdi:crosshairs-gps" />
            </button>
          </div>
        </div>

        <p class="quality-review-reason">
          {{ item.subtitle }}
        </p>

        <div v-if="hasRowAction(item)" class="quality-row-actions">
          <KitBtn
            v-if="item.effectiveProposal && (preview || previewBatch)"
            size="xs"
            variant="tonal"
            color="primary"
            :disabled="busy"
            @click="applySingleItemPreview(item)"
          >
            <Icon icon="mdi:check" />
            {{ formatProposalSummary(item.effectiveProposal) }}
          </KitBtn>

          <KitBtn
            v-if="analyze && canItemUseAi(item)"
            variant="outlined"
            color="primary"
            size="xs"
            :disabled="busy"
            :aria-label="`Проверить с ИИ участок с ${time(item.issue.startedAt, timeZone)}`"
            @click="analyzeSingleIssue(item)"
          >
            <Icon icon="mdi:sparkles" />
            {{ selectedIssue === item.issue && busy && !batchAiProgress ? 'Проверяем…' : 'Проверить с ИИ' }}
          </KitBtn>
        </div>

        <p v-if="selectedIssue === item.issue && analysisError" class="quality-error-text" role="alert">
          {{ analysisError }}
        </p>
      </article>

      <KitBtn
        v-if="issueLimit < filteredIssues.length"
        variant="text"
        size="sm"
        class="quality-full-btn"
        @click="issueLimit += 30"
      >
        Показать ещё ({{ filteredIssues.length - issueLimit }})
      </KitBtn>
    </div>
  </section>
</template>

<style scoped lang="scss">
.track-quality {
  display: grid;
  gap: 10px;
  font-size: 0.82rem;
}

p {
  margin: 0;
  color: var(--fg-secondary-color);
  line-height: 1.42;
}

dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

dt {
  color: var(--fg-secondary-color);
}

dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.quality-full-btn {
  width: 100%;
  justify-content: center;
}

.quality-clean-note {
  padding: 7px 10px;
  border-radius: var(--r-s);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
}

.quality-summary-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--r-s);
  font-size: 0.78rem;
  line-height: 1.35;

  &.is-clean {
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
  }

  &.is-draft {
    background: color-mix(in srgb, var(--fg-accent-color) 10%, var(--bg-tertiary-color));
    color: var(--fg-primary-color);
  }
}

.quality-segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 3px;
  padding: 3px;
  border-radius: var(--r-m);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
}

.segmented-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: calc(var(--r-m) - 3px);
  background: transparent;
  color: var(--fg-secondary-color);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &.is-active {
    background: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    font-weight: 600;
    box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  }
}

.segmented-count {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.quality-action-bar {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--r-m);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
}

.action-bar-caption {
  font-size: 0.77rem;
}

.action-bar-buttons {
  display: grid;
  gap: 6px;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--fg-primary-color);
}

.progress-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 500;
}

.progress-counter {
  font-variant-numeric: tabular-nums;
  font-size: 0.76rem;
  color: var(--fg-secondary-color);
}

.quality-progress {
  width: 100%;
  height: 5px;
  border: 0;
  border-radius: var(--r-full);
  overflow: hidden;
  appearance: none;
  background: var(--border-secondary-color);

  &::-webkit-progress-bar {
    background: var(--border-secondary-color);
    border-radius: var(--r-full);
  }

  &::-webkit-progress-value {
    background: var(--fg-accent-color);
    border-radius: var(--r-full);
    transition: width 0.2s ease;
  }

  &::-moz-progress-bar {
    background: var(--fg-accent-color);
    border-radius: var(--r-full);
  }
}

.inline-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid var(--fg-accent-color);
  border-right-color: transparent;
  border-radius: 50%;
  flex-shrink: 0;
  animation: quality-spin 0.75s linear infinite;
}

@keyframes quality-spin {
  to {
    transform: rotate(360deg);
  }
}

.quality-hero-status {
  font-size: 0.78rem;
  color: var(--fg-success-color, #16a34a);
}

.quality-empty-state {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 5px;
  padding: 22px 12px;

  .empty-icon {
    font-size: 1.85rem;
    color: var(--fg-success-color, #16a34a);
  }

  strong {
    color: var(--fg-primary-color);
    font-size: 0.9rem;
  }
}

.quality-issues {
  display: grid;
  gap: 8px;
}

.quality-issue {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);

  &.is-ready {
    border-color: color-mix(in srgb, var(--fg-accent-color) 40%, var(--border-secondary-color));
  }

  &.is-resolved {
    opacity: 0.88;
  }
}

.quality-issue-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quality-issue-link {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 0;
  text-align: left;
  background: none;
  border: 0;
  color: var(--fg-primary-color);
  font: inherit;
  cursor: pointer;

  &:hover .quality-issue-title {
    color: var(--fg-accent-color);
  }
}

.quality-issue-meta {
  color: var(--fg-secondary-color);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}

.quality-issue-title {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
}

.quality-issue-side {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.quality-seek-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 0.95rem;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.quality-status-chip {
  padding: 2px 7px;
  border-radius: var(--r-full);
  font-size: 0.69rem;
  font-weight: 600;
  white-space: nowrap;

  &.is-applied,
  &.is-clean {
    background: var(--bg-success-color, rgb(22 163 74 / 12%));
    color: var(--fg-success-color, #16a34a);
  }

  &.is-ready {
    background: color-mix(in srgb, var(--fg-accent-color) 14%, transparent);
    color: var(--fg-accent-color);
  }

  &.is-live {
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);
  }
}

.quality-review-reason {
  font-size: 0.78rem;
}

.quality-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
}

.quality-error-text {
  font-size: 0.78rem;
  color: var(--fg-error-color, #c45148);
}
</style>
