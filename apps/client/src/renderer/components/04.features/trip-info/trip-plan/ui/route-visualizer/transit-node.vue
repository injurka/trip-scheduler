<script setup lang="ts">
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/geolocation-section'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { activityTagColors, activityTagIcons, getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityStatus } from '~/shared/types/models/activity'

interface Props {
  activity: IActivity
  index: number
  isFirst?: boolean
  isLast?: boolean
  orientation?: 'horizontal' | 'vertical'
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFirst: false,
  isLast: false,
  orientation: 'horizontal',
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'select', activityId: string): void
  (e: 'edit', activity: IActivity): void
  (e: 'delete', activityId: string): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
}>()

const tagInfo = computed(() => getTagInfo(props.activity.tag))

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

const hasGeolocation = computed(() => {
  const geoSection = props.activity.sections?.find(
    s => s.type === EActivitySectionType.GEOLOCATION,
  ) as ActivitySectionGeolocation | undefined
  return !!(geoSection && (geoSection.points?.length || geoSection.routes?.length))
})

const hasBooking = computed(() => {
  return props.activity.sections?.some(s => s.type === EActivitySectionType.BOOKING)
})

const isCompleted = computed(() => props.activity.status === EActivityStatus.COMPLETED)
const isSkipped = computed(() => props.activity.status === EActivityStatus.SKIPPED)

function handleNodeClick() {
  if (props.isEditMode) {
    emit('edit', props.activity)
  }
  else {
    emit('select', props.activity.id)
  }
}
</script>

<template>
  <div
    class="transit-node"
    :class="[
      `transit-node--${orientation}`,
      {
        'is-completed': isCompleted,
        'is-skipped': isSkipped,
        'is-edit-mode': isEditMode,
      },
    ]"
    :style="{
      '--node-accent': tagInfo?.color || 'var(--fg-accent-color)',
    }"
    @click="handleNodeClick"
  >
    <!-- Edit handle for Drag & Drop -->
    <div v-if="isEditMode" class="node-drag-handle drag-handle" title="Перетащите для изменения порядка" @click.stop>
      <Icon icon="mdi:drag" />
    </div>

    <!-- Node Ring / Stop Marker -->
    <div class="node-marker-wrapper">
      <div class="node-marker" :style="{ backgroundColor: tagInfo?.color || activityTagColors.activity }">
        <Icon :icon="tagInfo?.icon || activityTagIcons.activity" class="marker-icon" />
      </div>
      <div class="node-index-badge">
        {{ index + 1 }}
      </div>
    </div>

    <!-- Node Card / Content -->
    <div class="node-content">
      <div class="node-header">
        <div class="node-time">
          <span class="time-range">{{ activity.startTime }} - {{ activity.endTime }}</span>
          <span v-if="durationMinutes > 0" class="time-dur">({{ formattedDuration }})</span>
        </div>

        <div class="node-badges">
          <span v-if="tagInfo" class="node-tag-pill" :style="{ backgroundColor: tagInfo.color }">
            {{ tagInfo.label }}
          </span>

          <KitTooltip v-if="hasGeolocation" text="Есть гео-локация">
            <span class="meta-icon-badge">
              <Icon icon="mdi:map-marker" />
            </span>
          </KitTooltip>

          <KitTooltip v-if="hasBooking" text="Есть привязанное бронирование">
            <span class="meta-icon-badge">
              <Icon icon="mdi:ticket-confirmation-outline" />
            </span>
          </KitTooltip>
        </div>
      </div>

      <div class="node-title" :title="activity.title">
        {{ activity.title || 'Без названия' }}
      </div>

      <!-- Metro stops summary if present -->
      <div v-if="metroRides.length > 0" class="node-metro-preview">
        <div
          v-for="ride in metroRides"
          :key="ride.id"
          class="metro-ride-tag"
          :style="{ borderColor: ride.lineColor }"
        >
          <span class="metro-line-indicator" :style="{ backgroundColor: ride.lineColor }">
            {{ ride.lineNumber || 'M' }}
          </span>
          <span class="metro-stations">
            {{ ride.startStation || '...' }} → {{ ride.endStation || '...' }}
          </span>
        </div>
      </div>

      <!-- Edit controls inside node -->
      <div v-if="isEditMode" class="node-edit-controls" @click.stop>
        <button class="node-action-btn edit" title="Быстрое редактирование" @click.stop="emit('edit', activity)">
          <Icon icon="mdi:pencil" />
        </button>
        <button class="node-action-btn move" :disabled="isFirst" title="Сдвинуть влево/вверх" @click.stop="emit('moveUp')">
          <Icon :icon="orientation === 'horizontal' ? 'mdi:chevron-left' : 'mdi:chevron-up'" />
        </button>
        <button class="node-action-btn move" :disabled="isLast" title="Сдвинуть вправо/вниз" @click.stop="emit('moveDown')">
          <Icon :icon="orientation === 'horizontal' ? 'mdi:chevron-right' : 'mdi:chevron-down'" />
        </button>
        <button class="node-action-btn delete" title="Удалить активность" @click.stop="emit('delete', activity.id)">
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.transit-node {
  position: relative;
  display: flex;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--s-xs);
  flex-shrink: 0;

  @include hover {
    & {
      transform: translateY(-2px);
      border-color: var(--fg-accent-color);
      box-shadow: var(--s-m);
      background: var(--bg-hover-color);

      .node-marker {
        transform: scale(1.1);
        box-shadow: 0 0 12px var(--node-accent);
      }
    }
  }

  &--horizontal {
    flex-direction: column;
    width: 220px;
    min-height: 120px;

    .node-marker-wrapper {
      position: absolute;
      top: -16px;
      left: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 3;
    }

    .node-content {
      margin-top: 8px;
    }
  }

  &--vertical {
    flex-direction: row;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
    min-height: 80px;

    .node-marker-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  &.is-edit-mode {
    border-style: dashed;
    border-color: var(--border-primary-color);

    &:hover {
      border-color: var(--fg-accent-color);
    }
  }

  &.is-completed {
    opacity: 0.85;
    .node-title {
      text-decoration: line-through;
      color: var(--fg-tertiary-color);
    }
  }

  &.is-skipped {
    opacity: 0.5;
    filter: grayscale(0.6);
  }
}

.node-marker-wrapper {
  .node-marker {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--bg-primary-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
    color: #1a1a1a;

    .marker-icon {
      font-size: 1rem;
    }
  }

  .node-index-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--fg-tertiary-color);
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 999px;
    padding: 0 5px;
    line-height: 1.3;
  }
}

.node-drag-handle {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--fg-tertiary-color);
  cursor: grab;
  padding: 2px;
  border-radius: var(--r-2xs);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;

  &:hover {
    color: var(--fg-accent-color);
    background: var(--bg-secondary-color);
  }

  &:active {
    cursor: grabbing;
  }
}

.node-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.node-time {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  color: var(--fg-secondary-color);
  font-weight: 600;

  .time-dur {
    font-size: 0.68rem;
    color: var(--fg-tertiary-color);
    font-weight: 500;
  }
}

.node-badges {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-tag-pill {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  color: #1a1a1a;
  line-height: 1.2;
}

.meta-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary-color);
  font-size: 0.85rem;
}

.node-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.node-metro-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.metro-ride-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary-color);
  border-left: 3px solid;
  border-radius: 0 var(--r-2xs) var(--r-2xs) 0;
  padding: 2px 6px;
  font-size: 0.7rem;

  .metro-line-indicator {
    color: #fff;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 0.65rem;
  }

  .metro-stations {
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.node-edit-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-secondary-color);

  .node-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--r-xs);
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--fg-primary-color);
      border-color: var(--border-primary-color);
      background: var(--bg-hover-color);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    &.edit:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }

    &.delete:hover {
      color: var(--fg-error-color);
      border-color: var(--fg-error-color);
      background: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}
</style>
