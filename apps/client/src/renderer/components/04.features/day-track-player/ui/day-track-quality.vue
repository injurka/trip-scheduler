<script setup lang="ts">
import type {
  ActivityCorrection,
  recordingQuality,
  TrackGeometryAction,
  TrackQualityIssue,
} from '@limiteddissolve/track-processing'
import type { DayPoint } from '../models/types'
import { explainTrackGeometry, hasCoherentTrackGeometry, inspectTrackGeometry, trackGeometryContextMs } from '@limiteddissolve/track-processing'
import { computed, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { upperTimeIndex } from '../lib/track-time-window'

interface QualityAnalysis {
  action: TrackGeometryAction | null
  reason: string
  affectedFixes: number
}
interface QualityProposal {
  issue: TrackQualityIssue
  action: TrackGeometryAction
}

type ReviewGroup = 'ready' | 'manual' | 'coherent'

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
  'smooth-drift': 'Сгладить отклонение GPS на маршруте',
  'exclude-manual': 'Исключить точку из маршрута',
}
const maxReviewDurationMs = 120_000
const issueLimit = ref(30)
const selectedGroup = ref<ReviewGroup>()
const manualIssue = shallowRef<TrackQualityIssue>()
const batchError = ref('')
const selectedIssue = shallowRef<TrackQualityIssue>()
const busy = ref(false)
const analysisError = ref('')

const groupedIssues = computed(() => {
  const groups: TrackQualityIssue[] = []
  const lastBySession = new Map<string, TrackQualityIssue>()

  for (const issue of props.quality.issues) {
    const previous = lastBySession.get(issue.sessionId)

    if (issue.kind === 'accuracy' && previous?.kind === 'accuracy'
      && issue.startedAt - previous.endedAt <= 15_000 && issue.endedAt - previous.startedAt <= maxReviewDurationMs) {
      previous.endedAt = Math.max(previous.endedAt, issue.endedAt)
      previous.points += issue.points
    }
    else {
      const group = { ...issue }
      groups.push(group)
      lastBySession.set(issue.sessionId, group)
    }
  }

  return groups.sort((a, b) => (b.endedAt - b.startedAt) - (a.endedAt - a.startedAt) || a.startedAt - b.startedAt)
})
const inaccurateGroups = computed(() => groupedIssues.value.filter(issue => issue.kind === 'accuracy').length)
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
const issueRows = computed(() => groupedIssues.value.map((issue) => {
  const correction = correctionFor(issue)
  const review = !correction && issue.kind === 'accuracy' ? reviewAvailability(issue) : undefined
  const suggestion = results.value[issueKey(issue)]
  const action = review?.action && (suggestion ? suggestion.action : review.action)
  const group: ReviewGroup = action && props.preview ? 'ready' : review?.coherent ? 'coherent' : 'manual'

  return {
    issue,
    correction,
    review,
    suggestion,
    action,
    group,
  }
}))
const batchProposals = computed(() => issueRows.value.flatMap(({ issue, action, group }) => action && group === 'ready' ? [{ issue, action }] : [])
  .slice(0, props.batchCapacity ?? 200))
const tabs = computed(() => ([
  { id: 'ready', label: 'Можно исправить' },
  { id: 'manual', label: 'Нужно посмотреть' },
  { id: 'coherent', label: 'Точность снижена' },
] as const).map(tab => ({ ...tab, count: issueRows.value.filter(row => row.group === tab.id).length })).filter(tab => tab.count > 0))
const activeGroup = computed(() => tabs.value.some(tab => tab.id === selectedGroup.value) ? selectedGroup.value : tabs.value[0]?.id)
const groupIssues = computed(() => issueRows.value.filter(row => row.group === activeGroup.value))
const visibleIssues = computed(() => groupIssues.value.slice(0, issueLimit.value))
const manualPoints = computed(() => {
  const issue = manualIssue.value

  if (!issue)
    return []

  const points = pointsBySession.value.get(issue.sessionId) ?? []
  const from = upperTimeIndex(points, issue.startedAt - 1)
  const to = upperTimeIndex(points, issue.endedAt)

  return points.slice(from, to).filter((point, index) => (point.accuracy ?? 0) > 35 && !point.localPending
    && points[from + index - 1]?.tsUtc !== point.tsUtc && points[from + index + 1]?.tsUtc !== point.tsUtc
    && !correctionFor(issueAtPoint(issue, point)))
})

watch(activeGroup, () => {
  issueLimit.value = 30
  manualIssue.value = undefined
})
watch(groupedIssues, () => {
  issueLimit.value = 30
  selectedIssue.value = undefined
  manualIssue.value = undefined
  analysisError.value = ''
  batchError.value = ''
})

function reviewAvailability(issue: TrackQualityIssue) {
  const points = pointsBySession.value.get(issue.sessionId) ?? []
  const start = upperTimeIndex(points, issue.startedAt - trackGeometryContextMs - 1)
  const end = upperTimeIndex(points, issue.endedAt + trackGeometryContextMs)
  const context = points.slice(start, end)

  if (context.some(point => point.localPending))
    return { reason: 'Дождитесь синхронизации GPS-точек.' }

  if (issue.endedAt - issue.startedAt > maxReviewDurationMs)
    return { reason: 'Участок слишком длинный для автоматической правки.' }

  const candidate = inspectTrackGeometry(context, issue.startedAt, issue.endedAt)

  if (candidate)
    return { action: candidate.action }

  return {
    coherent: hasCoherentTrackGeometry(context, issue.startedAt, issue.endedAt),
    reason: explainTrackGeometry(context, issue.startedAt, issue.endedAt),
  }
}
function issueKey(issue: TrackQualityIssue) {
  return `${issue.sessionId}:${issue.kind}:${issue.startedAt}:${issue.endedAt}`
}
function issueAtPoint(issue: TrackQualityIssue, point: DayPoint): TrackQualityIssue {
  return { ...issue, startedAt: point.tsUtc, endedAt: point.tsUtc, points: 1 }
}
async function previewDay() {
  if (!props.previewBatch || !batchProposals.value.length || busy.value)
    return

  busy.value = true
  batchError.value = ''

  try {
    await props.previewBatch(batchProposals.value)
  }
  catch (error) {
    batchError.value = error instanceof Error ? error.message : 'Не удалось подготовить правки.'
  }
  finally {
    busy.value = false
  }
}
function correctionFor(issue: TrackQualityIssue) {
  return props.corrections?.find(c => c.geometryAction && c.sessionId === issue.sessionId
    && c.startedAt <= issue.endedAt && c.endedAt >= issue.startedAt)
}
async function analyzeIssue(issue: TrackQualityIssue) {
  if (!props.analyze || busy.value || results.value[issueKey(issue)] || !issueRows.value.some(row => row.issue === issue && row.review?.action))
    return

  selectedIssue.value = issue
  analysisError.value = ''
  busy.value = true

  try {
    const result = await props.analyze(issue)

    if (selectedIssue.value === issue)
      results.value = { ...results.value, [issueKey(issue)]: result }
  }
  catch (error) {
    if (selectedIssue.value === issue)
      analysisError.value = error instanceof Error ? error.message : 'Не удалось проверить участок.'
  }
  finally {
    busy.value = false
  }
}
async function previewSuggestion(issue: TrackQualityIssue, action: TrackGeometryAction, target = issue) {
  if (!props.preview || busy.value)
    return

  selectedIssue.value = issue
  busy.value = true
  analysisError.value = ''

  try {
    await props.preview(target, action)
  }
  catch (error) {
    analysisError.value = error instanceof Error ? error.message : 'Не удалось подготовить правку.'
  }
  finally {
    busy.value = false
  }
}
function duration(ms: number) {
  return `${Math.round(ms / 60000)} мин`
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
        <dt>Неточные участки &gt;35 м</dt>
        <dd>
          {{ inaccurateGroups }} ·
          {{ duration(quality.inaccurateDurationMs) }} ·
          {{ quality.inaccuratePercent.toFixed(1) }}%
        </dd>
      </div>
      <div>
        <dt>Без данных о точности</dt>
        <dd>{{ quality.unknownAccuracyPoints }} точек</dd>
      </div>
      <div>
        <dt>Сохранённые правки</dt>
        <dd>{{ quality.manualCorrections }}</dd>
      </div>
    </dl>
    <p>
      Пауза — промежуток сверх ожидаемой частоты замеров: обычно более 30 с, при
      экономии в покое — более 75 с. Причина неизвестна; потеря GPS не
      подтверждена. Время после последней точки не оценивается.
    </p>
    <KitBtn
      v-if="groupedIssues.length"
      size="sm"
      variant="tonal"
      @click="emit('review')"
    >
      Разобрать участки · {{ groupedIssues.length }}
    </KitBtn>
    <slot />
  </section>
  <section v-else class="track-quality">
    <div v-if="previewBatch && tabs.some(tab => tab.id === 'ready')" class="quality-batch">
      <p>Правки можно посмотреть на карте перед сохранением.</p>
      <KitBtn
        size="sm"
        variant="tonal"
        :disabled="busy || !batchProposals.length"
        @click="previewDay"
      >
        Предпросмотр правок за день · {{ batchProposals.length }}
      </KitBtn>
      <p v-if="batchError" role="alert">
        {{ batchError }}
      </p>
    </div>
    <nav v-if="tabs.length" class="quality-tabs" aria-label="Группы участков">
      <KitBtn
        v-for="tab in tabs"
        :key="tab.id"
        size="sm"
        :variant="tab.id === activeGroup ? 'tonal' : 'text'"
        :aria-pressed="tab.id === activeGroup"
        @click="selectedGroup = tab.id"
      >
        {{ tab.label }} · {{ tab.count }}
      </KitBtn>
    </nav>
    <p v-if="activeGroup === 'coherent'">
      Точки согласуются с маршрутом. Правка не нужна.
    </p>
    <p v-else-if="!tabs.length">
      Проблемных участков нет.
    </p>
    <div v-else class="quality-issues">
      <div
        v-for="{ issue, correction, review, suggestion, action, group } in visibleIssues"
        :key="issueKey(issue)"
        class="quality-issue"
      >
        <div class="quality-issue-header">
          <button
            class="quality-issue-link"
            type="button"
            title="Посмотреть участок на карте"
            @click="emit('seek', issue)"
          >
            <span>{{ issue.kind === 'pause' ? 'Пауза' : 'Неточные координаты' }}</span>
            <span class="quality-issue-time">{{ time(issue.startedAt, timeZone) }}–{{ time(issue.endedAt, timeZone) }}</span>
          </button>
          <span v-if="correction" class="quality-issue-time">Есть правка GPS</span>
          <span v-else-if="suggestion" class="quality-issue-time">Проверено ИИ</span>
          <KitBtn
            v-else-if="review?.action && analyze"
            variant="text"
            color="primary"
            size="sm"
            :disabled="busy"
            :aria-label="`Проверить с ИИ участок с ${time(issue.startedAt, timeZone)}`"
            @click="analyzeIssue(issue)"
          >
            Проверить с ИИ
          </KitBtn>
        </div>
        <p v-if="review?.reason" class="quality-review-reason">
          {{ review.reason }}
        </p>
        <p v-if="issue.kind === 'pause'" class="quality-review-reason">
          Пунктир на карте покажет связь между замерами. Путь между ними неизвестен.
        </p>
        <div v-if="action && preview" class="quality-row-actions">
          <KitBtn
            size="sm"
            variant="tonal"
            :disabled="busy"
            @click="previewSuggestion(issue, action)"
          >
            Предпросмотр на карте
          </KitBtn>
          <p>{{ actionLabels[action] }}</p>
        </div>
        <template v-if="preview && group === 'manual' && issue.kind === 'accuracy' && (!correction || correction.geometryAction === 'exclude-manual')">
          <KitBtn
            size="sm"
            variant="text"
            :aria-expanded="manualIssue === issue"
            @click="manualIssue = manualIssue === issue ? undefined : issue"
          >
            Точки участка
          </KitBtn>
          <ul v-if="manualIssue === issue" class="quality-manual-points">
            <li v-for="point in manualPoints" :key="point.clientPointId" class="quality-row-actions">
              <KitBtn size="sm" variant="text" @click="emit('seek', issueAtPoint(issue, point))">
                {{ time(point.tsUtc, timeZone) }} · {{ Math.round(point.accuracy ?? 0) }} м
              </KitBtn>
              <KitBtn
                size="sm"
                variant="text"
                :disabled="busy"
                @click="previewSuggestion(issue, 'exclude-manual', issueAtPoint(issue, point))"
              >
                Исключить из маршрута
              </KitBtn>
            </li>
            <li v-if="!manualPoints.length">
              Нет отдельных синхронизированных точек для исключения.
            </li>
          </ul>
        </template>
        <div v-if="selectedIssue === issue || (!correction && suggestion)" class="quality-suggestion">
          <p v-if="selectedIssue === issue && busy && !suggestion" role="status">
            Анализируем замеры…
          </p>
          <p v-if="selectedIssue === issue && analysisError" role="alert">
            {{ analysisError }}
          </p>
          <template v-if="suggestion">
            <p role="status">
              {{ suggestion.reason }}
            </p>
          </template>
        </div>
      </div>
      <KitBtn
        v-if="issueLimit < groupIssues.length"
        variant="text"
        size="sm"
        @click="issueLimit += 30"
      >
        Ещё 30 участков
      </KitBtn>
    </div>
  </section>
</template>

<style scoped lang="scss">
.track-quality {
  display: grid;
  gap: 10px;
  font-size: 0.8rem;
}
p {
  margin: 0;
  color: var(--fg-secondary-color);
  line-height: 1.5;
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
}
.quality-tabs,
.quality-batch,
.quality-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.quality-manual-points {
  padding: 0;
  list-style: none;
}

.quality-review-reason {
  padding: 0 4px 6px;
}

.quality-issues {
  display: grid;
  padding: 0 6px 6px;
}
.quality-issue + .quality-issue {
  border-top: 1px solid var(--border-secondary-color);
}

.quality-issue-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  column-gap: 6px;
}

.quality-issue-link {
  display: grid;
  gap: 2px;
  min-height: 40px;
  padding: 4px;
  text-align: left;
  background: none;
  border: 0;
  color: var(--fg-primary-color);
  font: inherit;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.quality-issue-time {
  color: var(--fg-secondary-color);
  font-variant-numeric: tabular-nums;
}

.quality-suggestion {
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 4px 4px 8px;
}
</style>
