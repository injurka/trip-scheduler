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
type IssueFilter = 'all' | 'ready' | 'ai' | 'gaps'
interface EnrichedIssueItem {
  issue: TrackQualityIssue
  category: 'glitch' | 'activity' | 'gap'
  correction?: ActivityCorrection
  pendingSync: boolean
  tooLong: boolean
  autoAction?: TrackGeometryAction
  suggestion?: QualityAnalysis
  effectiveProposal?: QualityProposal
  maxAccuracyM?: number
  gapDistanceM?: number
  title: string
  subtitle: string
}
interface Props {
  quality: ReturnType<typeof recordingQuality>
  summaryOnly?: boolean
  rawPoints?: DayPoint[]
  timeZone?: string
  corrections?: ActivityCorrection[]
  analyze?: (issue: TrackQualityIssue) => Promise<QualityAnalysis>
  preview?: (issue: TrackQualityIssue, action: TrackGeometryAction) => Promise<void>
  previewBatch?: (proposals: QualityProposal[]) => Promise<void>
  batchCapacity?: number
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
const maxReviewDurationMs = 300_000
const issueLimit = ref(30)
const selectedFilter = ref<IssueFilter>('all')
const selectedIssue = shallowRef<TrackQualityIssue>()
const busy = ref(false)
const batchAiProgress = ref<{ done: number, total: number } | null>(null)
const batchAiSummary = ref('')
const analysisError = ref('')
const batchError = ref('')
const autoActionTitles: Record<TrackGeometryAction, string> = {
  'exclude-spike': 'Скачок GPS в сторону',
  'collapse-drift': 'Ложный разброс на стоянке',
  'smooth-drift': 'Зигзаг при слабом сигнале',
  'exclude-manual': 'Точки-выбросы GPS',
}

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
const groupedAccuracyAndGapIssues = computed(() => {
  const groups: TrackQualityIssue[] = []
  const lastBySession = new Map<string, TrackQualityIssue>()

  for (const issue of props.quality.issues) {
    const previous = lastBySession.get(issue.sessionId)

    if (issue.kind === 'accuracy' && previous?.kind === 'accuracy'
      && issue.startedAt - previous.endedAt <= 20_000 && issue.endedAt - previous.startedAt <= maxReviewDurationMs) {
      previous.endedAt = Math.max(previous.endedAt, issue.endedAt)
      previous.points += issue.points
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
const readyProposals = computed<QualityProposal[]>(() => {
  const cap = Math.max(0, props.batchCapacity ?? 200)
  const list: QualityProposal[] = []
  let used = 0

  for (const item of enrichedIssues.value) {
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
  enrichedIssues.value.filter(item =>
    item.category !== 'gap'
    && !item.correction
    && !item.pendingSync
    && !item.tooLong
    && !results.value[issueKey(item.issue)]))
const filters = computed(() => {
  const all = enrichedIssues.value.length
  const ready = enrichedIssues.value.filter(i => i.effectiveProposal).length
  const ai = aiEligibleItems.value.length
  const gaps = enrichedIssues.value.filter(i => i.category === 'gap').length

  return ([
    { id: 'all' as const, label: 'Все', count: all },
    { id: 'ready' as const, label: 'Готовы к правке', count: ready },
    { id: 'ai' as const, label: 'Проверить с ИИ', count: ai },
    { id: 'gaps' as const, label: 'Разрывы', count: gaps },
  ]).filter(tab => tab.id === 'all' ? all > 0 : tab.count > 0)
})
const activeFilter = computed<IssueFilter>(() =>
  filters.value.some(f => f.id === selectedFilter.value) ? selectedFilter.value : 'all')
const filteredIssues = computed(() => {
  const list = enrichedIssues.value

  if (activeFilter.value === 'ready')
    return list.filter(i => i.effectiveProposal)

  if (activeFilter.value === 'ai')
    return list.filter(i => i.category !== 'gap' && !i.correction && !i.pendingSync && !i.tooLong && !results.value[issueKey(i.issue)])

  if (activeFilter.value === 'gaps')
    return list.filter(i => i.category === 'gap')

  return list
})
const visibleIssues = computed(() => filteredIssues.value.slice(0, issueLimit.value))

watch(activeFilter, () => {
  issueLimit.value = 30
})
watch(enrichedIssues, () => {
  selectedIssue.value = undefined
  analysisError.value = ''
  batchError.value = ''
})

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

    if (runStart >= 0) {
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
  }

  return found
}
function enrichPauseIssue(issue: TrackQualityIssue, sessionPts: DayPoint[], hasRaw: boolean): EnrichedIssueItem | null {
  let gapDistanceM: number | undefined

  if (hasRaw) {
    const fromPt = sessionPts.find(p => p.tsUtc === issue.startedAt)
    const toPt = sessionPts.find(p => p.tsUtc === issue.endedAt)

    if (fromPt && toPt) {
      gapDistanceM = Math.round(haversineM(
        fromPt.lat,
        fromPt.lng,
        toPt.lat,
        toPt.lng,
      ))

      if (gapDistanceM <= 45)
        return null
    }
  }

  return {
    issue,
    category: 'gap',
    pendingSync: false,
    tooLong: false,
    gapDistanceM,
    title: gapDistanceM ? `Разрыв сигнала · ~${formatMeters(gapDistanceM)}` : 'Пауза в записи',
    subtitle: 'Сигнал временно отсутствовал во время перемещения. Нажмите, чтобы показать участок пунктиром на карте.',
  }
}
function describeGlitchTitle(isUnknownActivityIssue: boolean, autoAction?: TrackGeometryAction): string {
  if (isUnknownActivityIssue)
    return 'Не определён транспорт'

  return autoAction ? autoActionTitles[autoAction] : 'Сбой точности GPS'
}
function describeGlitchSubtitle(options: {
  hasGeomCorrection: boolean
  pendingSync: boolean
  tooLong: boolean
  suggestion?: QualityAnalysis
  autoAction?: TrackGeometryAction
  isUnknownActivityIssue: boolean
}): string {
  if (options.hasGeomCorrection)
    return 'Для этого участка уже применена правка маршрута.'

  if (options.pendingSync)
    return 'Дождитесь синхронизации точек с сервером для проверки участка.'

  if (options.tooLong)
    return 'Длинный участок слабого сигнала — проверьте его визуально на карте.'

  if (options.suggestion)
    return options.suggestion.reason

  if (options.autoAction)
    return `${actionLabels[options.autoAction]} — можно сразу сравнить До и После на карте или перепроверить с ИИ.`

  return options.isUnknownActivityIssue
    ? 'Автоматика не смогла уверенно определить способ передвижения. ИИ проверит скорость и соседние сегменты.'
    : 'Сложная траектория при сниженной точности спутников. Проверьте участок с ИИ, чтобы точечно убрать выбросы.'
}
function maxIssueAccuracy(context: DayPoint[], issue: TrackQualityIssue): number | undefined {
  let maxAcc = 0

  for (const p of context) {
    if (p.tsUtc >= issue.startedAt && p.tsUtc <= issue.endedAt)
      maxAcc = Math.max(maxAcc, Math.round(p.accuracy ?? 0))
  }

  return maxAcc > 0 ? maxAcc : undefined
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
function canAutoInspectGlitch(
  pendingSync: boolean,
  tooLong: boolean,
  hasRaw: boolean,
  isUnknownActivityIssue: boolean,
): boolean {
  return !pendingSync && !tooLong && hasRaw && !isUnknownActivityIssue
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
  const tooLong = issue.endedAt - issue.startedAt > maxReviewDurationMs
  const blocked = pendingSync || tooLong
  const geomCorrection = geometryCorrectionFor(issue)
  const autoAction = detectAutoGeometryAction(context, issue, canAutoInspectGlitch(
    pendingSync,
    tooLong,
    hasRaw,
    isUnknownActivityIssue,
  ))
  const suggestion = results.value[issueKey(issue)]
  const effectiveProposal = blocked
    ? undefined
    : buildEffectiveProposal(
        issue,
        autoAction,
        suggestion,
        Boolean(geomCorrection),
      )

  return {
    issue,
    category: isUnknownActivityIssue ? 'activity' : 'glitch',
    correction: geomCorrection ?? correctionFor(issue),
    pendingSync,
    tooLong,
    autoAction,
    suggestion,
    effectiveProposal,
    maxAccuracyM: maxIssueAccuracy(context, issue),
    title: describeGlitchTitle(isUnknownActivityIssue, autoAction),
    subtitle: describeGlitchSubtitle({
      hasGeomCorrection: Boolean(geomCorrection),
      pendingSync,
      tooLong,
      suggestion,
      autoAction,
      isUnknownActivityIssue,
    }),
  }
}
function compareEnrichedIssues(a: EnrichedIssueItem, b: EnrichedIssueItem): number {
  const score = (item: EnrichedIssueItem) => item.effectiveProposal ? 3 : item.category !== 'gap' ? 2 : 1

  return score(b) - score(a)
    || (b.issue.endedAt - b.issue.startedAt) - (a.issue.endedAt - a.issue.startedAt)
    || a.issue.startedAt - b.issue.startedAt
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
  hasGeomCorrection: boolean,
): QualityProposal | undefined {
  if (hasGeomCorrection)
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
  if (!props.analyze || busy.value || item.pendingSync || item.tooLong)
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

  batchAiSummary.value = 'ИИ проверил спорные участки: дополнительных искажений, требующих правки, не найдено.'
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
    batchError.value = error instanceof Error ? error.message : 'Не удалось выполнить ИИ-нормализацию.'
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
      Пауза — промежуток сверх обычной частоты записи (от 30–75 с); потеря GPS не подтверждена. Участки со сниженной точностью, которые ровно ложатся на маршрут, не требуют исправления.
    </p>
    <KitBtn
      v-if="enrichedIssues.length"
      size="sm"
      variant="tonal"
      @click="emit('review')"
    >
      Нормализовать маршрут · {{ enrichedIssues.length }}
    </KitBtn>
    <p v-else class="quality-clean-note">
      Сбоев маршрута, требующих исправления, не обнаружено.
    </p>
    <slot />
  </section>

  <section v-else class="track-quality">
    <div
      v-if="(analyze && aiEligibleItems.length) || (previewBatch && readyProposals.length)"
      class="quality-hero-card"
    >
      <div class="quality-hero-head">
        <Icon icon="mdi:auto-fix" class="quality-hero-icon" />
        <div class="quality-hero-text">
          <strong>Умная нормализация маршрута</strong>
          <p>
            ИИ проанализирует сбойные участки, уберёт GPS-выбросы и уточнит вид транспорта. Перед сохранением вы сможете сравнить маршрут «До» и «После» прямо на карте.
          </p>
        </div>
      </div>

      <div class="quality-hero-actions">
        <KitBtn
          v-if="analyze && aiEligibleItems.length"
          size="sm"
          color="primary"
          :disabled="busy"
          @click="runSmartAiNormalization"
        >
          <Icon icon="mdi:sparkles" />
          {{ batchAiProgress ? `Проверяем с ИИ (${batchAiProgress.done}/${batchAiProgress.total})…` : `Нормализовать с ИИ · ${Math.min(12, aiEligibleItems.length)}` }}
        </KitBtn>

        <KitBtn
          v-if="previewBatch && readyProposals.length"
          size="sm"
          variant="tonal"
          :disabled="busy"
          @click="applyProposalsPreview(readyProposals)"
        >
          Предпросмотр правок за день · {{ readyProposals.length }}
        </KitBtn>
      </div>

      <p v-if="batchAiSummary" class="quality-hero-status" role="status">
        {{ batchAiSummary }}
      </p>
      <p v-if="batchError" class="quality-error-text" role="alert">
        {{ batchError }}
      </p>
    </div>

    <nav v-if="filters.length > 2" class="quality-tabs" aria-label="Фильтр участков">
      <KitBtn
        v-for="tab in filters"
        :key="tab.id"
        size="xs"
        :variant="tab.id === activeFilter ? 'tonal' : 'text'"
        :aria-pressed="tab.id === activeFilter"
        @click="selectedFilter = tab.id"
      >
        {{ tab.label }} · {{ tab.count }}
      </KitBtn>
    </nav>

    <div v-if="!enrichedIssues.length" class="quality-empty-state">
      <Icon icon="mdi:check-circle-outline" class="empty-icon" />
      <strong>Маршрут в порядке</strong>
      <p>Все записанные точки согласуются с траекторией движения. Правка не требуется.</p>
    </div>

    <div v-else class="quality-issues">
      <article
        v-for="item in visibleIssues"
        :key="issueKey(item.issue)"
        class="quality-issue"
      >
        <div class="quality-issue-header">
          <button
            class="quality-issue-link"
            type="button"
            title="Перейти к участку на карте"
            @click="emit('seek', item.issue)"
          >
            <span class="quality-issue-title-row">
              <Icon
                :icon="item.category === 'gap' ? 'mdi:transit-connection-horizontal' : item.category === 'activity' ? 'mdi:help-rhombus-outline' : 'mdi:map-marker-alert-outline'"
                class="issue-type-icon"
              />
              <strong>{{ item.title }}</strong>
            </span>
            <span class="quality-issue-meta">
              {{ time(item.issue.startedAt, timeZone) }}–{{ time(item.issue.endedAt, timeZone) }}
              <template v-if="item.issue.points > 0"> · {{ item.issue.points }} точ.</template>
              <template v-if="item.maxAccuracyM"> · до ±{{ item.maxAccuracyM }} м</template>
            </span>
          </button>

          <span v-if="item.correction" class="quality-status-chip is-applied">
            Исправлено
          </span>
          <span v-else-if="item.suggestion" class="quality-status-chip is-ai">
            Проверено ИИ
          </span>
        </div>

        <p class="quality-review-reason">
          {{ item.subtitle }}
        </p>

        <div class="quality-row-actions">
          <KitBtn
            size="xs"
            variant="text"
            color="secondary"
            @click="emit('seek', item.issue)"
          >
            <Icon icon="mdi:map-search-outline" />
            Показать на карте
          </KitBtn>

          <KitBtn
            v-if="item.effectiveProposal && (preview || previewBatch)"
            size="xs"
            variant="tonal"
            color="primary"
            :disabled="busy"
            @click="applySingleItemPreview(item)"
          >
            <Icon icon="mdi:eye-check-outline" />
            {{ formatProposalSummary(item.effectiveProposal) }}
          </KitBtn>

          <KitBtn
            v-if="analyze && item.category !== 'gap' && !item.correction && !item.suggestion && !item.pendingSync && !item.tooLong"
            variant="outlined"
            color="primary"
            size="xs"
            :disabled="busy"
            :aria-label="`Проверить с ИИ участок с ${time(item.issue.startedAt, timeZone)}`"
            @click="analyzeSingleIssue(item)"
          >
            <Icon icon="mdi:sparkles" />
            {{ selectedIssue === item.issue && busy && !batchAiProgress ? 'Анализируем…' : 'Проверить с ИИ' }}
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
  gap: 12px;
  font-size: 0.82rem;
}

p {
  margin: 0;
  color: var(--fg-secondary-color);
  line-height: 1.45;
}

dl {
  display: grid;
  gap: 8px;
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

.quality-clean-note {
  padding: 6px 10px;
  border-radius: var(--r-s);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
}

.quality-hero-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: var(--r-m);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
}

.quality-hero-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.quality-hero-icon {
  font-size: 1.35rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
  margin-top: 1px;
}

.quality-hero-text {
  display: grid;
  gap: 3px;

  strong {
    font-size: 0.88rem;
    color: var(--fg-primary-color);
  }

  p {
    font-size: 0.78rem;
  }
}

.quality-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quality-hero-status {
  font-size: 0.78rem;
  color: var(--fg-success-color, #16a34a);
}

.quality-tabs,
.quality-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.quality-empty-state {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 6px;
  padding: 24px 12px;

  .empty-icon {
    font-size: 2rem;
    color: var(--fg-success-color, #16a34a);
  }

  strong {
    color: var(--fg-primary-color);
    font-size: 0.92rem;
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
}

.quality-issue-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quality-issue-link {
  display: grid;
  gap: 2px;
  padding: 0;
  text-align: left;
  background: none;
  border: 0;
  color: var(--fg-primary-color);
  font: inherit;
  cursor: pointer;

  &:hover strong {
    color: var(--fg-accent-color);
    text-decoration: underline;
  }
}

.quality-issue-title-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  strong {
    font-size: 0.85rem;
    font-weight: 600;
  }
}

.issue-type-icon {
  font-size: 1rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
}

.quality-issue-meta {
  color: var(--fg-secondary-color);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.quality-status-chip {
  padding: 2px 8px;
  border-radius: var(--r-full);
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;

  &.is-applied {
    background: var(--bg-success-color);
    color: var(--fg-success-color);
  }

  &.is-ai {
    background: var(--bg-tertiary-color);
    color: var(--fg-accent-color);
    border: 1px solid var(--border-secondary-color);
  }
}

.quality-review-reason {
  font-size: 0.79rem;
}

.quality-error-text {
  font-size: 0.78rem;
  color: var(--fg-error-color, #c45148);
}
</style>
