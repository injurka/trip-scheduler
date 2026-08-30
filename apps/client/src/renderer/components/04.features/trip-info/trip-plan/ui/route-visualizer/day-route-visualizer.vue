<script setup lang="ts">
import type { IActivity, IDay } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro, EActivityStatus } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { onKeyStroke } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType } from '~/shared/types/models/activity'
import QuickActivityDialog from './quick-activity-dialog.vue'
import TransitCanvas from './transit-canvas.vue'

interface Props {
  day: IDay
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'scrollToActivity', activityId: string): void
}>()

const store = useModuleStore(['plan', 'ui'])
const { isViewMode } = storeToRefs(store.ui)

const isLocalEditMode = ref(false)
const isFullscreen = ref(false)
const canvasRef = ref<InstanceType<typeof TransitCanvas> | null>(null)

const isEditModeActive = computed(() => {
  if (props.readonly || isViewMode.value)
    return false
  return isLocalEditMode.value
})

const sortedActivities = computed(() => {
  return (props.day.activities || []).slice().sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  )
})

// Statistics
const totalStops = computed(() => sortedActivities.value.length)

const metroLinesCount = computed(() => {
  const lineNames = new Set<string>()
  sortedActivities.value.forEach((act) => {
    act.sections?.forEach((sec) => {
      if (sec.type === EActivitySectionType.METRO) {
        const metroSec = sec as ActivitySectionMetro
        metroSec.rides?.forEach((ride) => {
          if (ride.lineName || ride.lineNumber) {
            lineNames.add(ride.lineName || ride.lineNumber || '')
          }
        })
      }
    })
  })
  return lineNames.size
})

const dayTimeSpan = computed(() => {
  if (sortedActivities.value.length === 0)
    return null
  const first = sortedActivities.value[0]
  const last = sortedActivities.value[sortedActivities.value.length - 1]
  const startMin = timeToMinutes(first.startTime)
  const endMin = timeToMinutes(last.endTime)
  const diffMin = Math.max(0, endMin - startMin)
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  const durationStr = mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
  return {
    start: first.startTime,
    end: last.endTime,
    duration: durationStr,
  }
})

// Quick Activity Dialog
const isQuickDialogVisible = ref(false)
const selectedActivityForEdit = ref<IActivity | null>(null)
const customDefaultStart = ref<string | undefined>()
const customDefaultEnd = ref<string | undefined>()

function handleOpenAddDialog(payload?: { startTime?: string, endTime?: string }) {
  selectedActivityForEdit.value = null
  customDefaultStart.value = payload?.startTime
  customDefaultEnd.value = payload?.endTime
  isQuickDialogVisible.value = true
}

function handleOpenEditDialog(activity: IActivity) {
  selectedActivityForEdit.value = activity
  customDefaultStart.value = undefined
  customDefaultEnd.value = undefined
  isQuickDialogVisible.value = true
}

function handleSaveActivity(activityData: Partial<IActivity>) {
  if (activityData.id) {
    const existing = sortedActivities.value.find(a => a.id === activityData.id)
    if (existing) {
      store.plan.updateActivity(props.day.id, {
        ...existing,
        ...activityData,
      } as IActivity)
    }
  }
  else {
    store.plan.addActivity(props.day.id, activityData as Omit<IActivity, 'id'>)
  }
}

function handleDeleteActivity(activityId: string) {
  store.plan.removeActivity(props.day.id, activityId)
}

function handleToggleStatus({ activity, status }: { activity: IActivity, status: EActivityStatus }) {
  store.plan.updateActivity(props.day.id, {
    ...activity,
    status,
  } as IActivity)
}

function handleMoveActivity({ activity, direction }: { activity: IActivity, direction: 'up' | 'down' }) {
  const list = [...sortedActivities.value]
  const currentIndex = list.findIndex(a => a.id === activity.id)
  if (currentIndex === -1)
    return

  if (direction === 'up' && currentIndex > 0) {
    [list[currentIndex], list[currentIndex - 1]] = [list[currentIndex - 1], list[currentIndex]]
    store.plan.reorderActivities(list)
  }
  else if (direction === 'down' && currentIndex < list.length - 1) {
    [list[currentIndex], list[currentIndex + 1]] = [list[currentIndex + 1], list[currentIndex]]
    store.plan.reorderActivities(list)
  }
}

function handleSelectActivity(activityId: string) {
  if (isFullscreen.value) {
    isFullscreen.value = false
  }
  emit('scrollToActivity', activityId)
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => {
    canvasRef.value?.fitToView()
  })
}

onKeyStroke('Escape', (e) => {
  if (isFullscreen.value) {
    e.preventDefault()
    isFullscreen.value = false
  }
})
</script>

<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div
      class="day-route-visualizer-container"
      :class="{ 'is-fullscreen': isFullscreen }"
    >
      <!-- Visualizer Header Toolbar -->
      <div class="visualizer-header">
        <div class="visualizer-header__left">
          <div class="header-badge">
            <Icon icon="mdi:transit-connection-variant" class="header-badge__icon" />
            <span class="header-badge__title">Интерактивная схема</span>
          </div>

          <div class="stats-summary">
            <span class="stat-pill">
              <Icon icon="mdi:map-marker-outline" />
              {{ totalStops }} {{ totalStops === 1 ? 'остановка' : (totalStops > 1 && totalStops < 5 ? 'остановки' : 'остановок') }}
            </span>

            <span v-if="metroLinesCount > 0" class="stat-pill metro">
              <Icon icon="mdi:subway-variant" />
              {{ metroLinesCount }} {{ metroLinesCount === 1 ? 'ветка метро' : 'веток метро' }}
            </span>

            <span v-if="dayTimeSpan" class="stat-pill time">
              <Icon icon="mdi:clock-time-four-outline" />
              {{ dayTimeSpan.start }} – {{ dayTimeSpan.end }} ({{ dayTimeSpan.duration }})
            </span>
          </div>
        </div>

        <div class="visualizer-header__right">
          <!-- Add stop button -->
          <KitBtn
            v-if="isEditModeActive"
            variant="solid"
            color="primary"
            size="xs"
            class="header-action-btn"
            @click="handleOpenAddDialog"
          >
            <Icon icon="mdi:plus" />
            <span>Добавить</span>
          </KitBtn>

          <!-- Edit Mode Toggle -->
          <KitTooltip
            v-if="!props.readonly && !isViewMode"
            :text="isLocalEditMode ? 'Завершить редактирование' : 'Режим редактирования схемы'"
          >
            <button
              class="header-tool-btn"
              :class="{ active: isLocalEditMode }"
              @click="isLocalEditMode = !isLocalEditMode"
            >
              <Icon :icon="isLocalEditMode ? 'mdi:check-bold' : 'mdi:pencil-outline'" />
            </button>
          </KitTooltip>

          <!-- Fullscreen Toggle -->
          <KitTooltip :text="isFullscreen ? 'Свернуть (Esc)' : 'На весь экран'">
            <button class="header-tool-btn" :class="{ active: isFullscreen }" @click="toggleFullscreen">
              <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
            </button>
          </KitTooltip>

          <!-- Close / Collapse Button -->
          <KitTooltip text="Свернуть схему">
            <button class="header-tool-btn close" @click="emit('close')">
              <Icon icon="mdi:close" />
            </button>
          </KitTooltip>
        </div>
      </div>

      <!-- Canvas Component -->
      <div class="visualizer-canvas-wrapper" :class="{ 'canvas-fullscreen': isFullscreen }">
        <TransitCanvas
          ref="canvasRef"
          :activities="sortedActivities"
          :is-edit-mode="isEditModeActive"
          @select-activity="handleSelectActivity"
          @edit-activity="handleOpenEditDialog"
          @delete-activity="handleDeleteActivity"
          @toggle-status="handleToggleStatus"
          @move-activity="handleMoveActivity"
          @add-activity="handleOpenAddDialog"
        />
      </div>

      <!-- Quick Activity Dialog -->
      <QuickActivityDialog
        v-if="isQuickDialogVisible"
        v-model:visible="isQuickDialogVisible"
        :activity="selectedActivityForEdit"
        :day-id="props.day.id"
        :default-start-time="customDefaultStart || (sortedActivities.length > 0 ? sortedActivities[sortedActivities.length - 1].endTime : '09:00')"
        :default-end-time="customDefaultEnd"
        @save="handleSaveActivity"
        @delete="handleDeleteActivity"
      />
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.day-route-visualizer-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  background: var(--bg-secondary-color);
  border-top: 1px solid var(--border-secondary-color);
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  overflow: hidden;

  &.is-fullscreen {
    position: fixed;
    top: env(safe-area-inset-top);
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
    padding: 16px 24px;
    border-radius: 0;
    border: none;
    background: var(--bg-primary-color);

    .visualizer-canvas-wrapper {
      flex: 1;
      height: calc(100vh - 80px);

      :deep(.transit-canvas-viewport) {
        height: 100%;
      }
    }
  }

  @include media-down(sm) {
    padding: 12px 10px 14px;
  }
}

.visualizer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;

  @include media-down(sm) {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px 10px;
  }
}

.visualizer-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  @include media-down(sm) {
    display: contents;
  }
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--fg-accent-color-rgb), 0.1);
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);
  border-radius: 999px;
  padding: 3px 10px;
  color: var(--fg-accent-color);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;

  .header-badge__icon {
    font-size: 0.95rem;
  }

  @include media-down(sm) {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }
}

.stats-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  @include media-down(sm) {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
  }
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.74rem;
  color: var(--fg-secondary-color);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  padding: 2px 7px;

  &.metro {
    color: var(--fg-accent-color);
    border-color: rgba(var(--fg-accent-color-rgb), 0.3);
  }

  &.time {
    font-variant-numeric: tabular-nums;
  }
}

.visualizer-header__right {
  display: flex;
  align-items: center;
  gap: 6px;

  @include media-down(sm) {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }
}

.header-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-xs);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.05rem;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-hover-color);
    border-color: var(--border-primary-color);
  }

  &.active {
    background: var(--fg-accent-color);
    color: #fff;
    border-color: var(--fg-accent-color);
  }

  &.close:hover {
    color: var(--fg-error-color);
    border-color: var(--fg-error-color);
  }
}

.visualizer-canvas-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--r-m);
}
</style>
