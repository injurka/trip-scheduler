<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { activityTagIcons, activityTagLabels } from '~/components/05.modules/trip-info/lib/helpers'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityStatus, EActivityTag } from '~/shared/types/models/activity'

interface Props {
  activity: IActivity | null
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'edit', activity: IActivity): void
  (e: 'delete', activityId: string): void
  (e: 'toggleStatus', payload: { activity: IActivity, status: EActivityStatus }): void
  (e: 'scrollToActivity', activityId: string): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const solidTagColors: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: '#3B82F6',
  [EActivityTag.WALK]: '#10B981',
  [EActivityTag.FOOD]: '#F59E0B',
  [EActivityTag.ATTRACTION]: '#8B5CF6',
  [EActivityTag.RELAX]: '#06B6D4',
  [EActivityTag.ACTIVITY]: '#64748B',
}

const tagColor = computed(() => {
  if (props.activity?.tag && solidTagColors[props.activity.tag]) {
    return solidTagColors[props.activity.tag]
  }
  return '#64748B'
})

const tagLabel = computed(() => {
  if (props.activity?.tag && activityTagLabels[props.activity.tag]) {
    return activityTagLabels[props.activity.tag]
  }
  return 'Активность'
})

const tagIcon = computed(() => {
  if (props.activity?.tag && activityTagIcons[props.activity.tag]) {
    return activityTagIcons[props.activity.tag]
  }
  return 'mdi:map-marker'
})

const descriptionModel = ref('')

watch(() => props.activity, (act) => {
  if (!act) {
    descriptionModel.value = ''
    return
  }
  const descSection = act.sections?.find(
    s => s.type === EActivitySectionType.DESCRIPTION,
  ) as { text?: string } | undefined
  descriptionModel.value = descSection?.text || act.explanation || ''
}, { immediate: true })

const durationMinutes = computed(() => {
  if (!props.activity)
    return 0
  const duration = timeToMinutes(props.activity.endTime) - timeToMinutes(props.activity.startTime)
  return Math.max(0, duration)
})

const formattedDuration = computed(() => {
  const dur = durationMinutes.value
  if (dur < 60)
    return `${dur} минут`
  const hours = Math.floor(dur / 60)
  const mins = dur % 60
  return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
})

const metroRides = computed(() => {
  const metroSection = props.activity?.sections?.find(
    s => s.type === EActivitySectionType.METRO,
  ) as ActivitySectionMetro | undefined
  return metroSection?.rides || []
})

const isCompleted = computed(() => props.activity?.status === EActivityStatus.COMPLETED)

function handleScrollTo() {
  if (!props.activity)
    return
  emit('scrollToActivity', props.activity.id)
  visible.value = false
}
</script>

<template>
  <KitDialogWithClose
    v-if="activity"
    v-model:visible="visible"
    title="Остановка маршрута"
    :max-width="480"
  >
    <div class="activity-preview-body">
      <!-- Top Card Header Box -->
      <div class="activity-header-box" :style="{ '--header-accent': tagColor }">
        <div class="header-pin" :style="{ backgroundColor: tagColor }">
          <Icon :icon="tagIcon" />
        </div>
        <div class="header-info">
          <div class="meta-row">
            <span class="category-pill" :style="{ backgroundColor: tagColor }">
              {{ tagLabel }}
            </span>
            <span class="time-range-badge">
              <Icon icon="mdi:clock-outline" />
              {{ activity.startTime }} – {{ activity.endTime }} ({{ formattedDuration }})
            </span>

            <!-- Subtle, non-intrusive jump button -->
            <button
              class="subtle-jump-btn"
              title="Перейти к этой активности в списке дня"
              @click="handleScrollTo"
            >
              <Icon icon="mdi:arrow-down-right" class="jump-icon" />
              <span>В список</span>
            </button>
          </div>

          <div class="activity-title" :class="{ 'is-completed': isCompleted }">
            {{ activity.title || 'Без названия' }}
          </div>
        </div>
      </div>

      <!-- Description rendered via standard Milkdown Markdown engine -->
      <div v-if="descriptionModel" class="activity-desc-box">
        <div class="desc-label">
          Описание
        </div>
        <KitInlineMdEditorWrapper
          :key="activity.id"
          v-model="descriptionModel"
          :readonly="true"
          :features="{ 'block-edit': false }"
          class="activity-md-viewer"
        />
      </div>

      <!-- Metro Transfer Details if Available -->
      <div v-if="metroRides.length > 0" class="metro-transfer-box">
        <div class="metro-title">
          <Icon icon="mdi:subway-variant" />
          <span>Поездка на метро</span>
        </div>
        <div
          v-for="ride in metroRides"
          :key="ride.id"
          class="metro-ride-item"
          :style="{ borderLeftColor: ride.lineColor }"
        >
          <div class="ride-line" :style="{ backgroundColor: ride.lineColor }">
            {{ ride.lineNumber || 'M' }} {{ ride.lineName }}
          </div>
          <div class="ride-path">
            {{ ride.startStation || 'Станция отправления' }} → {{ ride.endStation || 'Станция назначения' }}
          </div>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.activity-preview-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 2px;
}

.activity-header-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px 14px;
}

.header-pin {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 1.15rem;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  margin-top: 2px;
}

.header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.category-pill {
  font-size: 0.64rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  color: #ffffff;
  line-height: 1.2;
}

.time-range-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--fg-secondary-color);
  font-variant-numeric: tabular-nums;
}

.subtle-jump-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding: 2px 7px;
  border-radius: var(--r-xs);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  .jump-icon {
    font-size: 0.75rem;
    color: var(--fg-accent-color);
  }

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }
}

.activity-title {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  line-height: 1.35;
  word-break: break-word;

  &.is-completed {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
}

.activity-desc-box {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 10px 14px;

  .desc-label {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-tertiary-color);
    margin-bottom: 6px;
  }
}

.activity-md-viewer {
  :deep(.milkdown) {
    > div {
      padding: 0;
      min-height: auto;
      background: transparent;
    }

    .ProseMirror {
      p {
        font-size: 0.85rem;
        line-height: 1.6;
        color: var(--fg-primary-color);
        margin: 0 0 6px 0;

        &:last-child {
          margin-bottom: 0;
        }
      }

      ul,
      ol {
        padding-left: 18px;
        margin: 4px 0;
        font-size: 0.85rem;
        color: var(--fg-primary-color);
      }

      li {
        margin-bottom: 2px;
      }

      blockquote {
        border-left: 3px solid var(--fg-accent-color);
        padding-left: 8px;
        margin: 6px 0;
        color: var(--fg-secondary-color);
        font-style: italic;
      }

      code {
        background: var(--bg-tertiary-color);
        padding: 2px 4px;
        border-radius: var(--r-2xs);
        font-size: 0.78rem;
      }
    }
  }
}

.metro-transfer-box {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .metro-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
  }

  .metro-ride-item {
    border-left: 3px solid;
    padding: 2px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .ride-line {
      display: inline-block;
      align-self: flex-start;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
    }

    .ride-path {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }
}
</style>
