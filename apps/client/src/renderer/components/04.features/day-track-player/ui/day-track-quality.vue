<script setup lang="ts">
import type {
  ActivityCorrection,
  recordingQuality,
  TrackGeometryAction,
  TrackQualityIssue,
} from '@limiteddissolve/track-processing'
import type { DayPoint } from '../models/types'
import { explainTrackGeometry, inspectTrackGeometry, trackGeometryContextMs } from '@limiteddissolve/track-processing'
import { computed, ref, shallowReactive, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDisclosure } from '~/components/01.kit/kit-disclosure'
import { upperTimeIndex } from '../lib/track-time-window'

interface QualityAnalysis {
  action: TrackGeometryAction | null
  reason: string
  affectedFixes: number
}
interface Props {
  quality: ReturnType<typeof recordingQuality>
  rawPoints?: DayPoint[]
  timeZone?: string
  corrections?: ActivityCorrection[]
  analyze?: (issue: TrackQualityIssue) => Promise<QualityAnalysis>
  preview?: (issue: TrackQualityIssue, action: TrackGeometryAction) => Promise<void>
}

const props = defineProps<Props>()
const emit = defineEmits<{ seek: [issue: TrackQualityIssue] }>()

const actionLabels: Record<TrackGeometryAction, string> = {
  'exclude-spike': 'Убрать скачок GPS',
  'collapse-drift': 'Сгладить дрейф на остановке',
  'smooth-drift': 'Сгладить отклонение GPS на маршруте',
}
const maxReviewDurationMs = 120_000
const issueLimit = ref(30)
const selectedIssue = shallowRef<TrackQualityIssue>()
const results = shallowReactive(new Map<TrackQualityIssue, QualityAnalysis>())
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
  const review = props.analyze && !correction && issue.kind === 'accuracy'
    ? reviewAvailability(issue)
    : undefined

  return { issue, correction, review }
}))
const reviewSummary = computed(() => {
  const eligible = issueRows.value.filter(row => row.review?.action)
  const remaining = eligible.filter(row => !results.has(row.issue)).length

  if (remaining)
    return `Можно проверить с ИИ: ${remaining}`

  return eligible.length ? `Проверено ИИ: ${eligible.length}` : 'Подходящих участков для проверки с ИИ нет.'
})
const visibleIssues = computed(() => {
  const rows = issueRows.value
  const ready = rows.filter(row => row.review?.action)

  return [...ready, ...rows.filter(row => !row.review?.action)]
    .slice(0, issueLimit.value)
    .map(row => ({ ...row, suggestion: results.get(row.issue) }))
})

watch(groupedIssues, () => {
  issueLimit.value = 30
  selectedIssue.value = undefined
  results.clear()
  analysisError.value = ''
})

function reviewAvailability(issue: TrackQualityIssue) {
  if (issue.endedAt - issue.startedAt > maxReviewDurationMs)
    return { reason: 'Участок слишком длинный для автоматической правки.' }

  const points = pointsBySession.value.get(issue.sessionId) ?? []
  const start = upperTimeIndex(points, issue.startedAt - trackGeometryContextMs - 1)
  const end = upperTimeIndex(points, issue.endedAt + trackGeometryContextMs)
  const context = points.slice(start, end)

  if (context.some(point => point.localPending))
    return { reason: 'Дождитесь синхронизации GPS-точек.' }

  const candidate = inspectTrackGeometry(context, issue.startedAt, issue.endedAt)

  return candidate
    ? { action: candidate.action }
    : { reason: explainTrackGeometry(context, issue.startedAt, issue.endedAt) }
}
function correctionFor(issue: TrackQualityIssue) {
  return props.corrections?.find(c => c.geometryAction && c.sessionId === issue.sessionId
    && c.startedAt <= issue.endedAt && c.endedAt >= issue.startedAt)
}
async function analyzeIssue(issue: TrackQualityIssue) {
  if (!props.analyze || busy.value || results.has(issue) || !issueRows.value.some(row => row.issue === issue && row.review?.action))
    return

  selectedIssue.value = issue
  analysisError.value = ''
  busy.value = true

  try {
    const result = await props.analyze(issue)

    if (selectedIssue.value === issue)
      results.set(issue, result)
  }
  catch (error) {
    if (selectedIssue.value === issue)
      analysisError.value = error instanceof Error ? error.message : 'Не удалось проверить участок.'
  }
  finally {
    busy.value = false
  }
}
async function previewSuggestion(issue: TrackQualityIssue, action: TrackGeometryAction) {
  if (!props.preview || busy.value)
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
  <section class="track-quality">
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
    <KitDisclosure
      v-if="groupedIssues.length"
      v-slot="{ open }"
      label="Проблемные участки"
      :count="groupedIssues.length"
    >
      <p v-if="open && analyze" class="quality-review-count">
        {{ reviewSummary }}
      </p>
      <div v-if="open" class="quality-issues">
        <div
          v-for="{ issue, correction, review, suggestion } in visibleIssues"
          :key="`${issue.sessionId}:${issue.kind}:${issue.startedAt}`"
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
              v-else-if="review?.action"
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
          <div v-if="!correction && (selectedIssue === issue || suggestion)" class="quality-suggestion">
            <p v-if="selectedIssue === issue && busy && !suggestion" role="status">
              Анализируем замеры…
            </p>
            <p v-if="selectedIssue === issue && analysisError" role="alert">
              {{ analysisError }}
            </p>
            <template v-if="suggestion">
              <strong v-if="suggestion.action">
                {{ actionLabels[suggestion.action] }}
              </strong>
              <p role="status">
                {{ suggestion.reason }}
              </p>
              <KitBtn
                v-if="suggestion.action && analyze && preview"
                variant="tonal"
                size="sm"
                :disabled="busy"
                @click="previewSuggestion(issue, suggestion.action)"
              >
                Предпросмотр на карте
              </KitBtn>
              <KitBtn
                v-else-if="!suggestion.action"
                variant="text"
                color="secondary"
                size="sm"
                @click="emit('seek', issue)"
              >
                Посмотреть участок на карте
              </KitBtn>
            </template>
          </div>
        </div>
        <KitBtn
          v-if="issueLimit < groupedIssues.length"
          variant="text"
          size="sm"
          @click="issueLimit += 30"
        >
          Ещё 30 участков
        </KitBtn>
      </div>
    </KitDisclosure>
    <slot />
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
.quality-review-count {
  padding: 2px 10px 6px;
}

.quality-review-reason {
  padding: 0 4px 6px;
}

.quality-issues {
  display: grid;
  max-height: 230px;
  padding: 0 6px 6px;
  overflow: auto;
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
