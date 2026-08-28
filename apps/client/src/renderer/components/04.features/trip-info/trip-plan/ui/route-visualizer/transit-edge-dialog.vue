<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { activityTagIcons } from '~/components/05.modules/trip-info/lib/helpers'
import { EActivityTag } from '~/shared/types/models/activity'

export interface ITransitEdgeInfo {
  id: string
  fromActivity: IActivity
  toActivity: IActivity
  gapMinutes: number
  durationText: string | null
  metroRide: MetroRide | null
  color: string
  isDashed: boolean
}

interface Props {
  edgeInfo: ITransitEdgeInfo | null
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'insertActivity', payload: { startTime: string, endTime: string }): void
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

function getTagColor(tag?: EActivityTag): string {
  if (tag && solidTagColors[tag])
    return solidTagColors[tag]
  return '#64748B'
}

function getTagIcon(tag?: EActivityTag): string {
  if (tag && activityTagIcons[tag])
    return activityTagIcons[tag]
  return 'mdi:map-marker'
}

function handleInsert() {
  if (!props.edgeInfo)
    return
  const start = props.edgeInfo.fromActivity.endTime
  const end = props.edgeInfo.toActivity.startTime
  emit('insertActivity', { startTime: start, endTime: end })
  visible.value = false
}

function handleSelectActivity(id: string) {
  emit('scrollToActivity', id)
  visible.value = false
}
</script>

<template>
  <KitDialogWithClose
    v-if="edgeInfo"
    v-model:visible="visible"
    title="Информация о переходе"
    :max-width="480"
  >
    <div class="edge-dialog-body">
      <!-- Route Step Visualization -->
      <div class="transition-route-box">
        <!-- From Station -->
        <div class="station-step" @click="handleSelectActivity(edgeInfo.fromActivity.id)">
          <div class="step-bullet" :style="{ backgroundColor: getTagColor(edgeInfo.fromActivity.tag) }">
            <Icon :icon="getTagIcon(edgeInfo.fromActivity.tag)" />
          </div>
          <div class="step-details">
            <div class="step-label">
              Откуда
            </div>
            <div class="step-title">
              {{ edgeInfo.fromActivity.title || 'Остановка' }}
            </div>
            <div class="step-time">
              Окончание: <b>{{ edgeInfo.fromActivity.endTime }}</b>
            </div>
          </div>
          <Icon icon="mdi:chevron-right" class="step-arrow" />
        </div>

        <!-- Connection / Transit Info Bar -->
        <div class="transit-connector-bar">
          <div class="connector-line" :style="{ backgroundColor: edgeInfo.color }" />
          <div class="connector-pill" :class="{ 'is-error': edgeInfo.gapMinutes < 0 }">
            <Icon v-if="edgeInfo.metroRide" icon="mdi:subway-variant" />
            <Icon v-else-if="edgeInfo.gapMinutes < 0" icon="mdi:alert-circle" />
            <Icon v-else icon="mdi:clock-outline" />
            <span>
              {{ edgeInfo.gapMinutes < 0 ? `Пересечение по времени (${Math.abs(edgeInfo.gapMinutes)}м)` : `В пути / перерыв: ${edgeInfo.durationText || 'Без паузы'}` }}
            </span>
          </div>
        </div>

        <!-- To Station -->
        <div class="station-step" @click="handleSelectActivity(edgeInfo.toActivity.id)">
          <div class="step-bullet" :style="{ backgroundColor: getTagColor(edgeInfo.toActivity.tag) }">
            <Icon :icon="getTagIcon(edgeInfo.toActivity.tag)" />
          </div>
          <div class="step-details">
            <div class="step-label">
              Куда
            </div>
            <div class="step-title">
              {{ edgeInfo.toActivity.title || 'Остановка' }}
            </div>
            <div class="step-time">
              Начало: <b>{{ edgeInfo.toActivity.startTime }}</b>
            </div>
          </div>
          <Icon icon="mdi:chevron-right" class="step-arrow" />
        </div>
      </div>

      <!-- Metro Transfer Details if Available -->
      <div v-if="edgeInfo.metroRide" class="metro-details-card">
        <div class="metro-card-header">
          <div class="metro-line-tag" :style="{ backgroundColor: edgeInfo.metroRide.lineColor }">
            <Icon icon="mdi:subway-variant" />
            <span v-if="edgeInfo.metroRide.lineNumber">{{ edgeInfo.metroRide.lineNumber }}</span>
            <span>{{ edgeInfo.metroRide.lineName }}</span>
          </div>
        </div>
        <div class="metro-stations-row">
          <span>{{ edgeInfo.metroRide.startStation || 'Станция отправления' }}</span>
          <Icon icon="mdi:arrow-right" class="metro-arrow" />
          <span>{{ edgeInfo.metroRide.endStation || 'Станция назначения' }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="dialog-actions">
        <KitBtn
          v-if="isEditMode"
          variant="solid"
          color="primary"
          size="sm"
          class="insert-btn"
          @click="handleInsert"
        >
          <Icon icon="mdi:plus" />
          <span>Вставить активность в этот промежуток</span>
        </KitBtn>
        <KitBtn
          variant="outlined"
          color="secondary"
          size="sm"
          @click="visible = false"
        >
          Закрыть
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.edge-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 0;
}

.transition-route-box {
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.station-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
    transform: translateX(2px);

    .step-arrow {
      color: var(--fg-accent-color);
    }
  }

  .step-bullet {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 1rem;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .step-details {
    flex: 1;
    min-width: 0;
  }

  .step-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-tertiary-color);
  }

  .step-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .step-time {
    font-size: 0.72rem;
    color: var(--fg-secondary-color);
    font-variant-numeric: tabular-nums;
  }

  .step-arrow {
    font-size: 1.2rem;
    color: var(--fg-tertiary-color);
    transition: color 0.15s ease;
  }
}

.transit-connector-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;

  .connector-line {
    position: absolute;
    top: 50%;
    left: 24px;
    right: 24px;
    height: 3px;
    border-radius: 999px;
    opacity: 0.5;
    transform: translateY(-50%);
  }

  .connector-pill {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 999px;
    padding: 3px 12px;
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    &.is-error {
      border-color: var(--fg-error-color);
      color: var(--fg-error-color);
      background: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}

.metro-details-card {
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metro-card-header {
  display: flex;
  align-items: center;
}

.metro-line-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 0.74rem;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.metro-stations-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--fg-primary-color);

  .metro-arrow {
    color: var(--fg-tertiary-color);
    font-size: 1rem;
    flex-shrink: 0;
  }
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;

  .insert-btn {
    flex: 1;
  }
}
</style>
