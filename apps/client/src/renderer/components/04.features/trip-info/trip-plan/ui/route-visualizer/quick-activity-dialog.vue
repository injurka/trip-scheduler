<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { activityTagColors, activityTagIcons, activityTagLabels } from '~/components/05.modules/trip-info/lib/helpers'
import { minutesToTime, timeToMinutes } from '~/shared/lib/date-time'
import { EActivityStatus, EActivityTag } from '~/shared/types/models/activity'

interface Props {
  activity?: IActivity | null
  dayId: string
  defaultStartTime?: string
  defaultEndTime?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', activityData: Partial<IActivity>): void
  (e: 'delete', activityId: string): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const title = ref('')
const selectedTag = ref<EActivityTag>(EActivityTag.ACTIVITY)
const startTimeVal = shallowRef<Time | null>(null)
const endTimeVal = shallowRef<Time | null>(null)

function parseTimeToTime(timeStr?: string): Time {
  if (!timeStr)
    return new Time(9, 0)
  const [h, m] = timeStr.split(':').map(Number)
  return new Time(Number.isNaN(h) ? 9 : h, Number.isNaN(m) ? 0 : m)
}

function timeObjectToString(t: Time | null): string {
  if (!t)
    return '09:00'
  const h = t.hour.toString().padStart(2, '0')
  const m = t.minute.toString().padStart(2, '0')
  return `${h}:${m}`
}

watch(() => visible.value, (isOpen) => {
  if (isOpen) {
    if (props.activity) {
      title.value = props.activity.title || ''
      selectedTag.value = props.activity.tag || EActivityTag.ACTIVITY
      startTimeVal.value = parseTimeToTime(props.activity.startTime)
      endTimeVal.value = parseTimeToTime(props.activity.endTime)
    }
    else {
      title.value = ''
      selectedTag.value = EActivityTag.ACTIVITY
      const start = props.defaultStartTime || '09:00'
      const startMin = timeToMinutes(start)
      startTimeVal.value = parseTimeToTime(start)
      endTimeVal.value = parseTimeToTime(props.defaultEndTime || minutesToTime(startMin + 60))
    }
  }
}, { immediate: true })

function handleSave() {
  const sTime = timeObjectToString(startTimeVal.value)
  const eTime = timeObjectToString(endTimeVal.value)

  const payload: Partial<IActivity> = {
    title: title.value.trim() || 'Новая остановка',
    tag: selectedTag.value,
    startTime: sTime,
    endTime: eTime,
    dayId: props.dayId,
    status: props.activity?.status || EActivityStatus.NONE,
    sections: props.activity?.sections || [],
  }

  if (props.activity?.id) {
    payload.id = props.activity.id
  }

  emit('save', payload)
  visible.value = false
}

function handleDelete() {
  if (props.activity?.id) {
    emit('delete', props.activity.id)
    visible.value = false
  }
}
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visible"
    :title="props.activity ? 'Редактирование остановки' : 'Новая остановка'"
    :icon="props.activity ? 'mdi:pencil-outline' : 'mdi:plus-circle-outline'"
    :max-width="520"
  >
    <div class="quick-activity-form">
      <div class="form-row">
        <KitInput
          v-model="title"
          label="Название локации / активности"
          placeholder="Например: Завтрак в кафе, Башня Тайбэй 101"
          size="md"
        />
      </div>

      <div class="form-row">
        <label class="field-label">Категория / Тег</label>
        <div class="tag-selector-row">
          <div
            v-for="tag in Object.values(EActivityTag)"
            :key="tag"
            class="tag-pill-option"
            :class="{ active: selectedTag === tag }"
            :style="{
              '--tag-bg': activityTagColors[tag],
            }"
            @click="selectedTag = tag"
          >
            <Icon :icon="activityTagIcons[tag]" class="tag-icon" />
            <span class="tag-label">{{ activityTagLabels[tag] }}</span>
          </div>
        </div>
      </div>

      <div class="form-row time-row">
        <div class="time-field-col">
          <label class="field-label">Время начала</label>
          <KitTimeField v-model="startTimeVal" />
        </div>
        <div class="time-separator">
          →
        </div>
        <div class="time-field-col">
          <label class="field-label">Время окончания</label>
          <KitTimeField v-model="endTimeVal" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <KitBtn
          v-if="props.activity"
          variant="text"
          color="secondary"
          size="sm"
          class="delete-btn"
          @click="handleDelete"
        >
          <Icon icon="mdi:trash-can-outline" />
          Удалить
        </KitBtn>
        <div class="spacer" />
        <KitBtn variant="outlined" color="secondary" size="sm" @click="visible = false">
          Отмена
        </KitBtn>
        <KitBtn variant="solid" color="primary" size="sm" @click="handleSave">
          <Icon icon="mdi:check" />
          Сохранить
        </KitBtn>
      </div>
    </template>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.quick-activity-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}

.tag-selector-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-full);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;

  .tag-icon {
    font-size: 1rem;
  }

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.active {
    background: var(--tag-bg, var(--bg-accent-color));
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    font-weight: 600;
    box-shadow: 0 0 10px rgba(var(--fg-accent-color-rgb), 0.2);
  }
}

.time-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 12px;

  .time-field-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .time-separator {
    padding-bottom: 8px;
    font-size: 1.2rem;
    color: var(--fg-tertiary-color);
  }
}

.dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  .spacer {
    flex: 1;
  }

  .delete-btn {
    color: var(--fg-error-color) !important;

    &:hover {
      background: var(--bg-error-color) !important;
    }
  }
}
</style>
