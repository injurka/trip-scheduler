<script setup lang="ts">
import type {
  ActivityCorrection,
  recordingQuality,
  TrackGeometryAction,
  TrackQualityIssue,
} from '@limiteddissolve/track-processing'
import { computed, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDisclosure } from '~/components/01.kit/kit-disclosure'

interface QualityAnalysis {
  action: TrackGeometryAction | null
  reason: string
  affectedFixes: number
}

interface Props {
  quality: ReturnType<typeof recordingQuality>
  timeZone?: string
  corrections?: ActivityCorrection[]
  analyze?: (issue: TrackQualityIssue) => Promise<QualityAnalysis>
  preview?: (issue: TrackQualityIssue, action: TrackGeometryAction) => Promise<void>
}
const props = defineProps<Props>()
const emit = defineEmits<{ seek: [issue: TrackQualityIssue] }>()

const issueLimit = ref(30)

const selectedIssue = shallowRef<TrackQualityIssue>()
const suggestion = shallowRef<QualityAnalysis>()
const busy = ref(false)
const analysisError = ref('')
const groupedIssues = computed(() => {
  const groups: TrackQualityIssue[] = []
  const lastBySession = new Map<string, TrackQualityIssue>()

  for (const issue of props.quality.issues) {
    const previous = lastBySession.get(issue.sessionId)

    if (issue.kind === 'accuracy' && previous?.kind === 'accuracy'
      && issue.startedAt - previous.endedAt <= 15_000 && issue.endedAt - previous.startedAt <= 120_000) {
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
const visibleIssues = computed(() => groupedIssues.value.slice(0, issueLimit.value))

watch(groupedIssues, () => {
  issueLimit.value = 30
  selectedIssue.value = undefined
  suggestion.value = undefined
  analysisError.value = ''
})

function correctionFor(issue: TrackQualityIssue) {
  return props.corrections?.find(c => c.geometryAction && c.sessionId === issue.sessionId
    && c.startedAt <= issue.endedAt && c.endedAt >= issue.startedAt)
}

async function analyzeIssue(issue: TrackQualityIssue) {
  if (!props.analyze || busy.value)
    return

  selectedIssue.value = issue
  suggestion.value = undefined
  analysisError.value = ''
  busy.value = true

  try {
    const result = await props.analyze(issue)

    if (selectedIssue.value === issue)
      suggestion.value = result
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
      <div v-if="open" class="quality-issues">
        <div
          v-for="issue in visibleIssues"
          :key="`${issue.sessionId}:${issue.kind}:${issue.startedAt}`"
          class="quality-issue"
        >
          <div class="quality-issue-header">
            <button class="quality-issue-link" type="button" @click="emit('seek', issue)">
              <span>{{ issue.kind === 'pause' ? 'Пауза' : 'Неточные координаты' }}</span>
              <span class="quality-issue-time">{{ time(issue.startedAt, timeZone) }}–{{ time(issue.endedAt, timeZone) }}</span>
            </button>
            <span v-if="correctionFor(issue)" class="quality-issue-time">Есть правка GPS</span>
            <KitBtn
              v-else-if="analyze && issue.kind === 'accuracy' && issue.endedAt - issue.startedAt <= 120_000"
              variant="text"
              color="secondary"
              size="sm"
              :disabled="busy"
              :aria-label="`Проверить с ИИ участок с ${time(issue.startedAt, timeZone)}`"
              @click="analyzeIssue(issue)"
            >
              Проверить с ИИ
            </KitBtn>
            <span v-else-if="analyze && issue.kind === 'accuracy'" class="quality-issue-time">
              Нужна ручная проверка
            </span>
          </div>
          <div v-if="selectedIssue === issue" class="quality-suggestion">
            <p v-if="busy && !suggestion" role="status">
              Анализируем замеры…
            </p>
            <p v-if="analysisError" role="alert">
              {{ analysisError }}
            </p>
            <template v-if="suggestion">
              <strong v-if="suggestion.action">
                {{ suggestion.action === 'exclude-spike' ? 'Убрать скачок GPS' : 'Сгладить дрейф на остановке' }}
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
