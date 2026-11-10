<script setup lang="ts">
import type { DayData } from '../models/types'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitRadioGroup } from '~/components/01.kit/kit-radio-group'
import { trackingService } from '~/shared/services/database/tracking.service'
import { ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/types'

interface Props {
  dayData: DayData | null
  initialTime: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const visible = defineModel<boolean>('visible', { required: true })

const sessionId = ref('')
const start = ref<string | number | null>('')
const end = ref<string | number | null>('')
const activity = ref<ActivityType>('vehicle')
const pending = ref(false)
const error = ref('')
const options = (Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(value => ({ value, label: ACTIVITY_LABELS[value], icon: ACTIVITY_ICONS[value] }))

const sourcePoints = computed(() => props.dayData?.rawPoints ?? props.dayData?.points ?? [])
const sessions = computed(() => [...new Set(sourcePoints.value.map(p => p.sessionId))].map((value, index) => ({ value, label: `Запись ${index + 1}` })))
const corrections = computed(() => (props.dayData?.corrections ?? []).filter(c => c.sessionId === sessionId.value))

watch(visible, (open) => {
  if (!open)
    return

  const points = sourcePoints.value
  sessionId.value = points.find(p => p.tsUtc >= props.initialTime)?.sessionId ?? points[0]?.sessionId ?? ''
  resetRange(props.initialTime)
})

function inputTime(time: number) {
  return new Date(time).toISOString().slice(0, 19)
}
function formatTime(time: number) {
  return new Date(time).toLocaleString('ru-RU', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
  start.value = inputTime(segment?.startedAt ?? points[0].tsUtc)
  end.value = inputTime(segment?.endedAt ?? points[points.length - 1].tsUtc)
  activity.value = segment?.activity ?? 'vehicle'
  error.value = ''
}
function changeSession(value: string) {
  sessionId.value = value
  resetRange()
}
async function save() {
  const startedAt = Date.parse(`${start.value}Z`)
  const endedAt = Date.parse(`${end.value}Z`)

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
    error.value = 'Укажите начало и конец интервала; конец должен быть позже начала.'

    return
  }

  pending.value = true
  error.value = ''

  try {
    await trackingService.correctActivity({ sessionId: sessionId.value, startedAt, endedAt, activity: activity.value })
    emit('saved')
    visible.value = false
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось сохранить исправление'
  }
  finally {
    pending.value = false
  }
}
async function remove(id: string) {
  pending.value = true
  error.value = ''

  try {
    await trackingService.removeCorrection(id)
    emit('saved')
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось отменить исправление'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <KitDialogWithClose v-model:visible="visible" title="Исправить тип движения" description="Выберите временной интервал. Исправление сохранится после автоматического пересчёта, исходные GPS-данные останутся прежними.">
    <form class="activity-editor" @submit.prevent="save">
      <KitDropdown
        v-if="sessions.length > 1"
        :items="sessions"
        :model-value="sessionId"
        @update:model-value="changeSession"
      >
        <template #trigger>
          <KitBtn variant="outlined" :disabled="pending">
            {{ sessions.find(s => s.value === sessionId)?.label }}
          </KitBtn>
        </template>
      </KitDropdown>
      <KitInput
        v-model="start"
        type="datetime-local"
        label="Начало (UTC)"
        step="1"
        required
        :disabled="pending"
      />
      <KitInput
        v-model="end"
        type="datetime-local"
        label="Конец (UTC)"
        step="1"
        required
        :disabled="pending"
      />
      <KitRadioGroup
        v-model="activity"
        :options="options"
        :disabled="pending"
        aria-label="Тип движения"
      />
      <p v-if="error" class="editor-error" role="alert">
        {{ error }}
      </p>
      <KitBtn type="submit" :disabled="pending">
        {{ pending ? 'Сохранение…' : 'Применить к интервалу' }}
      </KitBtn>
      <div v-if="corrections.length" class="saved-corrections">
        <p>Сохранённые исправления (UTC)</p>
        <div v-for="correction in corrections" :key="correction.id" class="correction-row">
          <span>{{ formatTime(correction.startedAt) }} – {{ formatTime(correction.endedAt) }} · {{ ACTIVITY_LABELS[correction.activity] }}</span>
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
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.activity-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
</style>
