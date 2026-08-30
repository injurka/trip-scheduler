<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { activityTagIcons } from '~/components/05.modules/trip-info/lib/helpers'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityStatus, EActivityTag } from '~/shared/types/models/activity'

interface Props {
  activity: IActivity
  index: number
  isFirst?: boolean
  isLast?: boolean
  isEditMode?: boolean
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFirst: false,
  isLast: false,
  isEditMode: false,
  isSelected: false,
})

const emit = defineEmits<{
  (e: 'select', activity: IActivity): void
  (e: 'edit', activity: IActivity): void
  (e: 'delete', activityId: string): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
}>()

const solidTagColors: Record<EActivityTag, string> = {
  [EActivityTag.TRANSPORT]: '#3B82F6',
  [EActivityTag.WALK]: '#10B981',
  [EActivityTag.FOOD]: '#F59E0B',
  [EActivityTag.ATTRACTION]: '#8B5CF6',
  [EActivityTag.RELAX]: '#06B6D4',
  [EActivityTag.ACTIVITY]: '#64748B',
}

const tagColor = computed(() => {
  if (props.activity.tag && solidTagColors[props.activity.tag]) {
    return solidTagColors[props.activity.tag]
  }
  return '#64748B'
})

const isCompleted = computed(() => props.activity.status === EActivityStatus.COMPLETED)

const displayIcon = computed(() => {
  if (props.activity.tag && activityTagIcons[props.activity.tag]) {
    return activityTagIcons[props.activity.tag]
  }
  return 'mdi:map-marker'
})

const durationMinutes = computed(() => {
  const duration = timeToMinutes(props.activity.endTime) - timeToMinutes(props.activity.startTime)
  return Math.max(0, duration)
})

const formattedDuration = computed(() => {
  const dur = durationMinutes.value
  if (dur < 60)
    return `${dur}м`
  const hours = Math.floor(dur / 60)
  const mins = dur % 60
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
})

const metroRides = computed(() => {
  const metroSection = props.activity.sections?.find(
    s => s.type === EActivitySectionType.METRO,
  ) as ActivitySectionMetro | undefined
  return metroSection?.rides || []
})

function handleCardClick(e: MouseEvent) {
  e.stopPropagation()
  if (props.isEditMode) {
    emit('edit', props.activity)
  }
  else {
    emit('select', props.activity)
  }
}
</script>

<template>
  <div
    class="transit-node-card"
    :class="{
      'is-edit-mode': isEditMode,
      'is-selected': isSelected,
      'is-completed': isCompleted,
    }"
    :style="{
      '--accent-color': tagColor,
    }"
    @click="handleCardClick"
  >
    <!-- Left: Station Bullet on Track Line -->
    <div
      class="station-bullet"
      :style="{ backgroundColor: tagColor }"
    >
      <Icon :icon="displayIcon" class="bullet-icon" />
      <span class="bullet-index">{{ index + 1 }}</span>
    </div>

    <!-- Right: Clean Content Area -->
    <div class="card-content">
      <!-- Top Row: Time + Duration -->
      <div class="card-header-row">
        <div class="time-block">
          <Icon icon="mdi:clock-outline" class="clock-icon" />
          <span class="time-range">{{ activity.startTime }} – {{ activity.endTime }}</span>
          <span v-if="durationMinutes > 0" class="time-duration">({{ formattedDuration }})</span>
        </div>
      </div>

      <!-- Title: Comfortable 2-Line Text -->
      <div class="card-title" :class="{ 'title-done': isCompleted }" :title="activity.title">
        {{ activity.title || 'Остановка маршрута' }}
      </div>

      <!-- Metro Transfer Line if Present -->
      <div v-if="metroRides.length > 0" class="card-metro-row">
        <div
          v-for="ride in metroRides"
          :key="ride.id"
          class="metro-pill"
          :style="{ backgroundColor: ride.lineColor }"
        >
          <Icon icon="mdi:subway-variant" class="metro-icon" />
          <span v-if="ride.lineNumber" class="metro-num">{{ ride.lineNumber }}</span>
          <span class="metro-name">{{ ride.startStation || '...' }} → {{ ride.endStation || '...' }}</span>
        </div>
      </div>

      <!-- Edit Controls in Edit Mode -->
      <div v-if="isEditMode" class="card-edit-bar" @click.stop>
        <button class="edit-btn" title="Редактировать" @click.stop="emit('edit', activity)">
          <Icon icon="mdi:pencil" />
        </button>
        <button class="edit-btn" :disabled="isFirst" title="Назад" @click.stop="emit('moveUp')">
          <Icon icon="mdi:arrow-left" />
        </button>
        <button class="edit-btn" :disabled="isLast" title="Вперед" @click.stop="emit('moveDown')">
          <Icon icon="mdi:arrow-right" />
        </button>
        <button class="edit-btn delete" title="Удалить" @click.stop="emit('delete', activity.id)">
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.transit-node-card {
  position: relative;
  width: 100%;
  min-width: 170px;
  min-height: 72px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 10px 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-sizing: border-box;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--accent-color);
    box-shadow:
      0 6px 20px rgba(0, 0, 0, 0.25),
      0 0 12px rgba(var(--fg-accent-color-rgb), 0.18);

    .station-bullet {
      transform: scale(1.1);
      box-shadow: 0 0 12px var(--accent-color);
    }
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    box-shadow:
      0 0 0 2px var(--fg-accent-color),
      0 8px 24px rgba(0, 0, 0, 0.3);
  }

  &.is-edit-mode {
    border-style: dashed;
  }

  &.is-completed {
    opacity: 0.85;
    background: color-mix(in srgb, var(--bg-tertiary-color) 92%, #10b981 8%);
  }

  &.is-skipped {
    opacity: 0.45;
    filter: grayscale(0.7);
  }
}

.station-bullet {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--bg-secondary-color);
  margin-top: 1px;
  pointer-events: none;
  transition: transform 0.2s ease;

  .bullet-icon {
    font-size: 1rem;
    color: #ffffff;
  }

  .bullet-index {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-primary-color);
    font-size: 0.58rem;
    font-weight: 800;
    border-radius: 999px;
    padding: 0 4px;
    line-height: 1.2;
  }
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.time-block {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  .clock-icon {
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .time-range {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
  }

  .time-duration {
    font-size: 0.66rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
  }
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;

  &.done {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
}

.card-title {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;

  &.title-done {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
}

.card-metro-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}

.metro-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 600;
  max-width: 100%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

  .metro-icon {
    font-size: 0.78rem;
    flex-shrink: 0;
  }

  .metro-num {
    background: rgba(0, 0, 0, 0.25);
    padding: 0 3px;
    border-radius: 2px;
    font-weight: 700;
    font-size: 0.58rem;
  }

  .metro-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-edit-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--border-secondary-color);

  .edit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--r-xs);
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--fg-primary-color);
      border-color: var(--border-primary-color);
      background: var(--bg-hover-color);
    }

    &:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    &.delete:hover {
      color: var(--fg-error-color);
      border-color: var(--fg-error-color);
      background: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}
</style>
