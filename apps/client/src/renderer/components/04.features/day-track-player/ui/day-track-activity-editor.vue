<script setup lang="ts">
import type { CorrectionChoice } from '../composables/use-track-correction-drafts'
import type { DayData, DayPoint } from '../models/types'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { parseDateTime } from '@internationalized/date'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import tzLookup from 'tz-lookup'
import { computed, nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/types'
import TrackDateTimeField from './track-date-time-field.vue'

interface Props {
  stageCorrection: (choice: CorrectionChoice) => Promise<void>
  removeCorrection: (id: string) => Promise<void>
  tripId?: string
  dayData: DayData | null
  initialTime: number
}

const props = defineProps<Props>()
const visible = defineModel<boolean>('visible', { required: true })

const historyId = useId()

const sessionId = ref('')
const start = ref<string | number | null>('')
const end = ref<string | number | null>('')
const activity = ref<ActivityType>('vehicle')
const pending = ref(false)
const error = ref('')
let disposed = false
const options = (Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(value => ({ value, label: value === 'unknown' ? 'Другое' : ACTIVITY_LABELS[value], icon: ACTIVITY_ICONS[value] }))
const editorTimezone = ref('UTC')
const pointMode = ref(false)
const historyExpanded = ref(false)

const dialogVisible = computed({
  get: () => visible.value,
  set: (value: boolean) => {
    if (!pending.value)
      visible.value = value
  },
})
const sourcePoints = computed(() => props.dayData?.rawPoints ?? props.dayData?.points ?? [])
const sessions = computed(() => [...new Set(sourcePoints.value.map(p => p.sessionId))].map((value, index) => {
  const points = sourcePoints.value.filter(p => p.sessionId === value)
  const from = Math.min(...points.map(p => p.tsUtc))
  const to = Math.max(...points.map(p => p.tsUtc))
  const format = (time: number) => new Date(time).toLocaleTimeString('ru-RU', { timeZone: editorTimezone.value, hour: '2-digit', minute: '2-digit' })
  const minutes = Math.round((to - from) / 60000)

  return { value, label: `${format(from)}–${format(to)} · ${Math.floor(minutes / 60)} ч ${minutes % 60} мин · Запись ${index + 1}` }
}))
const corrections = computed(() => (props.dayData?.corrections ?? []).filter(c => c.sessionId === sessionId.value))
const timezoneLabel = computed(() => {
  const offset = new Intl.DateTimeFormat('ru-RU', { timeZone: editorTimezone.value, timeZoneName: 'shortOffset' }).formatToParts(new Date(props.initialTime)).find(p => p.type === 'timeZoneName')?.value

  return `Местное время · ${editorTimezone.value} · ${offset ?? ''}`
})
const inputTimeFormatter = computed(() => new Intl.DateTimeFormat('sv-SE', {
  timeZone: editorTimezone.value,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
}))

watch(sessionId, () => {
  historyExpanded.value = false
})
watch(visible, (open) => {
  if (!open)
    return

  historyExpanded.value = false
  const points = sourcePoints.value
  sessionId.value = points.find(p => p.tsUtc >= props.initialTime)?.sessionId ?? points[0]?.sessionId ?? ''
  const point = points.find(p => p.sessionId === sessionId.value && p.tsUtc >= props.initialTime) ?? points[0]

  try {
    editorTimezone.value = resolveEditorTimezone(point)
  }
  catch {
    editorTimezone.value = 'UTC'
  }

  resetRange(props.initialTime)
})

function resolveEditorTimezone(point?: DayPoint) {
  return props.dayData?.timeZone ?? (point ? tzLookup(point.lat, point.lng) : 'UTC')
}
function inputTime(time: number) {
  const parts = inputTimeFormatter.value.formatToParts(new Date(time))
  const part = (type: string) => parts.find(p => p.type === type)?.value

  return `${part('day')}.${part('month')}.${part('year')} ${part('hour')}:${part('minute')}:${part('second')}`
}
function parseInputTime(value: string | number | null) {
  const match = String(value).match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)

  if (!match)
    throw new Error('Некорректная дата')

  const [, day, month, year, hour, minute, second] = match

  return parseDateTime(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toDate(editorTimezone.value).getTime()
}
function formatTime(time: number) {
  return new Date(time).toLocaleString('ru-RU', { timeZone: editorTimezone.value, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function findSegment(time?: number) {
  if (time === undefined)
    return undefined

  return props.dayData?.segments.find(s => s.sessionId === sessionId.value && time >= s.startedAt && time <= s.endedAt)
}
function resetRange(time?: number) {
  const points = sourcePoints.value.filter(p => p.sessionId === sessionId.value)

  if (!points.length)
    return

  const segment = findSegment(time)
  pointMode.value = points.length === 1 || (!!segment && segment.startedAt === segment.endedAt)
  const selectedTime = time ?? points[0].tsUtc
  const bounds = segment ?? { startedAt: points[0].tsUtc, endedAt: points[points.length - 1].tsUtc }
  start.value = inputTime(pointMode.value ? selectedTime : bounds.startedAt)
  end.value = inputTime(pointMode.value ? selectedTime : bounds.endedAt)
  activity.value = segment?.activity ?? 'vehicle'
  error.value = ''
}
function changeSession(value: string) {
  sessionId.value = value
  const point = sourcePoints.value.find(p => p.sessionId === value)

  try {
    editorTimezone.value = resolveEditorTimezone(point)
  }
  catch {
    editorTimezone.value = 'UTC'
  }

  resetRange()
}
function readRange() {
  let startedAt = parseInputTime(start.value)

  if (pointMode.value) {
    const point = sourcePoints.value.filter(p => p.sessionId === sessionId.value && inputTime(p.tsUtc) === start.value).sort((a, b) => Math.abs(a.tsUtc - props.initialTime) - Math.abs(b.tsUtc - props.initialTime))[0]

    if (!point)
      throw new Error('Нет GPS-точки в выбранное время.')

    startedAt = point.tsUtc
  }

  const endedAt = pointMode.value ? startedAt : parseInputTime(end.value)

  if (endedAt < startedAt || (!pointMode.value && endedAt === startedAt))
    throw new Error('Конец интервала должен быть позже начала.')

  return { startedAt, endedAt }
}
async function save() {
  if (pending.value)
    return

  pending.value = true
  error.value = ''

  try {
    // Flush the busy state, then let the browser paint before synchronous track processing.
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))

    if (disposed || !visible.value)
      return

    const { startedAt, endedAt } = readRange()
    await props.stageCorrection({
      sessionId: sessionId.value,
      startedAt,
      endedAt,
      activity: activity.value,
      ...(pointMode.value ? { point: true } : {}),
    })
    // Parent updates rebuild the preview/map in the Vue flush; keep feedback visible until done.
    await nextTick()
    visible.value = false
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось добавить правку. Проверьте интервал и повторите.'
  }
  finally {
    pending.value = false
  }
}
async function remove(id: string) {
  if (pending.value)
    return

  pending.value = true
  error.value = ''

  try {
    await props.removeCorrection(id)
  }
  catch (err) { error.value = err instanceof Error ? err.message : 'Не удалось отменить правку' }
  finally { pending.value = false }
}

onScopeDispose(() => {
  disposed = true
})
</script>

<template>
  <KitDialogWithClose v-model:visible="dialogVisible" title="Исправить движение" :persistent="pending">
    <form class="activity-editor" :aria-busy="pending" @submit.prevent="save">
      <KitDropdown
        v-if="sessions.length > 1"
        :items="sessions"
        :model-value="sessionId"
        @update:model-value="changeSession"
      >
        <template #trigger>
          <KitBtn variant="text" size="sm" :disabled="pending">
            {{ sessions.find(s => s.value === sessionId)?.label }}
          </KitBtn>
        </template>
      </KitDropdown>
      <span v-if="sessions.length === 1" class="session-badge">{{ sessions[0].label }}</span>
      <p class="timezone-label">
        {{ timezoneLabel }}
      </p>
      <KitCheckbox v-model="pointMode" class="point-mode" :disabled="pending">
        Одна GPS-точка
      </KitCheckbox>
      <div class="time-interval">
        <TrackDateTimeField v-model="start" :label="pointMode ? 'Время точки' : 'Начало'" :disabled="pending" />
        <TrackDateTimeField
          v-if="!pointMode"
          v-model="end"
          label="Конец"
          :disabled="pending"
        />
      </div>
      <RadioGroupRoot
        v-model="activity"
        class="activity-options"
        :disabled="pending"
        aria-label="Тип движения"
      >
        <RadioGroupItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          class="activity-option"
        >
          <Icon :icon="option.icon" /><span>{{ option.label }}</span>
        </RadioGroupItem>
      </RadioGroupRoot>
      <p v-if="error" class="editor-error" role="alert">
        {{ error }}
      </p>
      <KitBtn type="submit" :disabled="pending">
        <span v-if="pending" class="pending-spinner" aria-hidden="true" />
        <span role="status" aria-live="polite">{{ pending ? 'Добавляем…' : 'Добавить в пакет' }}</span>
      </KitBtn>
      <div v-if="corrections.length" class="saved-corrections">
        <KitBtn
          type="button"
          variant="text"
          class="history-toggle"
          :disabled="pending"
          :aria-expanded="historyExpanded"
          :aria-controls="historyId"
          @click="historyExpanded = !historyExpanded"
        >
          <span class="history-heading">Правки трека <span class="history-count">{{ corrections.length }}</span></span>
          <Icon :icon="historyExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </KitBtn>
        <div v-if="historyExpanded" :id="historyId">
          <p class="history-hint">
            История: при пересечении применяется последнее исправление.
          </p>
          <div v-for="correction in corrections" :key="correction.id" class="correction-row">
            <div class="correction-summary">
              <Icon :icon="correction.geometryAction ? 'mdi:crosshairs-gps' : ACTIVITY_ICONS[correction.activity]" aria-hidden="true" />
              <div class="correction-description">
                <span class="correction-time">{{ formatTime(correction.startedAt) }}<template v-if="correction.endedAt !== correction.startedAt"> – {{ formatTime(correction.endedAt) }}</template></span>
                <span class="correction-activity">{{ correction.geometryAction ? 'Правка GPS' : ACTIVITY_LABELS[correction.activity] }}</span>
              </div>
            </div>
            <KitBtn
              type="button"
              size="sm"
              variant="text"
              :disabled="pending"
              @click="remove(correction.id)"
            >
              Отменить
            </KitBtn>
          </div>
        </div>
      </div>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.pending-spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  flex-shrink: 0;
  animation: editor-spin 0.8s linear infinite;
  will-change: transform;
}
@keyframes editor-spin {
  to {
    transform: rotate(360deg);
  }
}

.activity-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.time-interval {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 8px;
  :deep(input) {
    min-width: 0;
    width: 100%;
  }
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}
.timezone-label,
.interval-preview {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.activity-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  :deep(.kit-radio-item) {
    min-height: 44px;
    gap: 6px;
  }
}
.editor-error {
  color: var(--fg-error-color, #dc2626);
}
.correction-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.point-mode {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.85rem;
  min-height: 44px;
}
.session-badge {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: var(--r-s);
  color: var(--fg-accent-color);
  background: var(--bg-tertiary-color);
  font-size: 0.85rem;
}
.activity-option {
  font-size: 0.875rem;
  line-height: 1.4;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  min-height: 44px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  cursor: pointer;
  text-align: left;
}
.activity-option svg {
  width: 22px;
  height: 22px;
  font-size: 22px;
  flex-shrink: 0;
}
.activity-option[data-state='checked'] {
  color: var(--fg-accent-color);
  border-color: var(--fg-accent-color);
  background: color-mix(in srgb, var(--fg-accent-color) 10%, var(--bg-secondary-color));
}
.activity-option:focus-visible {
  outline: 2px solid var(--fg-accent-color);
  outline-offset: 2px;
}
.saved-corrections {
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 12px;
}
.history-toggle {
  width: 100%;
  min-height: 44px;
  justify-content: space-between;
  text-align: left;
  padding: 0 4px;
}
.history-toggle :deep(.kit-btn-content) {
  width: 100%;
  justify-content: space-between;
}
.history-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.history-toggle :deep(svg) {
  flex-shrink: 0;
  font-size: 20px;
}
.history-count {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  background: var(--bg-tertiary-color);
  padding: 2px 8px;
  border-radius: var(--r-full);
}
.correction-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.correction-summary > svg {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: var(--fg-secondary-color);
}
.correction-description {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.correction-time {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.correction-activity {
  color: var(--fg-secondary-color);
}
.history-hint {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}
.correction-row {
  padding: 6px 8px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  margin-top: 6px;
  font-size: 0.8rem;
}
.correction-row :deep(.kit-btn) {
  min-height: 44px;
  flex-shrink: 0;
}
</style>
