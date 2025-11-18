<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { IDay } from '../../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { useElementBounding, useIntersectionObserver, useWindowSize } from '@vueuse/core'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useDisplay } from '~/shared/composables/use-display'
import { useModuleStore } from '../../composables/use-trip-info-module'
import { useTripPermissions } from '../../composables/use-trip-permissions'
import DaysPanel from './days-panel.vue'
import ViewSwitcher from './view-switcher.vue'

interface Props {
  wrapperBounding: {
    left: number
    width: number
  }
}

const props = defineProps<Props>()

const store = useModuleStore(['ui', 'plan'])
const { isDaysPanelPinned, isDaysPanelOpen, isViewMode, activeView } = storeToRefs(store.ui)
const { getAllDays, getSelectedDay, isLoading, isLoadingNewDay } = storeToRefs(store.plan)
const { setCurrentDay, updateDayDetails } = store.plan
const appStore = useAppStore(['layout'])
const { isHeaderVisible, headerHeight } = storeToRefs(appStore.layout)
const { canEdit } = useTripPermissions()

const controlsRef = ref<HTMLElement | null>(null)
const fixedLeftControlsRef = ref<HTMLElement | null>(null)
const fixedRightControlsRef = ref<HTMLElement | null>(null)

const controlsAreVisible = ref(true)

const { mdAndUp } = useDisplay()

const { stop: stopIntersectionObserver } = useIntersectionObserver(
  controlsRef,
  ([{ isIntersecting }]) => {
    controlsAreVisible.value = isIntersecting
  },
  { threshold: 0.9 },
)

const { width: windowWidth } = useWindowSize()
const { width: leftControlsWidth } = useElementBounding(fixedLeftControlsRef)
const { width: rightControlsWidth } = useElementBounding(fixedRightControlsRef)

function handleAddNewDay() {
  store.plan.addNewDay()
  if (!store.ui.isDaysPanelPinned)
    store.ui.closeDaysPanel()
}

function toggleMode() {
  const newMode = isViewMode.value ? 'edit' : 'view'
  if (newMode === 'edit')
    store.ui.clearCollapsedState()

  store.ui.setInteractionMode(newMode)
}

const isDayInfoLoading = computed(() => isLoading.value || isLoadingNewDay.value)

const selectedCalendarDate = computed<CalendarDate | null>({
  get: () => {
    return getSelectedDay.value ? parseDate(getSelectedDay.value.date.split('T')[0]) : null
  },
  set: (newDate) => {
    if (!newDate || !getSelectedDay.value)
      return

    const currentDay = getSelectedDay.value
    const originalDate = currentDay.date
    const newDateString = newDate.toString() // 'YYYY-MM-DD'

    if (originalDate.startsWith(newDateString))
      return

    const newIsoDate = new Date(newDateString).toISOString()

    const occupiedDay = getAllDays.value.find(
      (day: IDay) => day.date.startsWith(newDateString) && day.id !== currentDay.id,
    )

    if (occupiedDay) {
      updateDayDetails(occupiedDay.id, { date: originalDate })
      updateDayDetails(currentDay.id, { date: newIsoDate })
    }
    else {
      updateDayDetails(currentDay.id, { date: newIsoDate })
    }
  },
})

const freeSpaceOnSide = computed(() => props.wrapperBounding.left)

const showFixedControls = computed(() =>
  mdAndUp.value
  && freeSpaceOnSide.value >= (Math.max(leftControlsWidth.value, rightControlsWidth.value) + 20)
  && !controlsAreVisible.value,
)

const topOffset = computed(() => (isHeaderVisible.value ? headerHeight.value : 0) + 20)

const fixedLeftControlsStyle = computed(() => ({
  top: `${topOffset.value}px`,
  left: `${props.wrapperBounding.left - leftControlsWidth.value - 40}px`,
}))

const fixedRightControlsStyle = computed(() => ({
  top: `${topOffset.value}px`,
  right: `${windowWidth.value - (props.wrapperBounding.left + props.wrapperBounding.width) - rightControlsWidth.value - 20}px`,
}))

onUnmounted(() => {
  stopIntersectionObserver()
})
</script>

<template>
  <div>
    <div ref="controlsRef" class="controls">
      <div class="left-controls">
        <button
          v-if="!isDaysPanelPinned"
          class="menu-btn"
          title="Открыть меню дней"
          @click="isDaysPanelOpen = !isDaysPanelOpen"
        >
          <Icon icon="mdi:menu" />
        </button>

        <div v-if="isDayInfoLoading" class="current-day-info-skeleton">
          <KitSkeleton width="100px" height="20px" border-radius="6px" type="wave" />
          <KitSkeleton width="80px" height="18px" border-radius="6px" type="wave" />
        </div>
        <CalendarPopover v-else v-model="selectedCalendarDate" :disabled="isViewMode">
          <template #trigger>
            <div class="current-day-info" role="button" :class="{ readonly: isViewMode }">
              <h3 v-if="getSelectedDay">
                {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }}
              </h3>
              <span v-if="getSelectedDay">
                {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { weekday: 'long' }) }}
              </span>
            </div>
          </template>
        </CalendarPopover>
      </div>
      <div class="spacer" />
      <div v-if="!isDayInfoLoading" class="right-controls">
        <div class="view-controls">
          <ViewSwitcher />
          <button
            v-if="canEdit && mdAndUp"
            class="split-view-btn"
            title="Отобразить План и Воспоминания"
            :class="{ 'is-active': activeView === 'split' }"
            @click="store.ui.setActiveView('split')"
          >
            <Icon icon="mdi:view-split-vertical" />
          </button>
        </div>
      </div>
    </div>

    <DaysPanel
      :is-open="isDaysPanelOpen"
      :days="getAllDays"
      :selected-day-id="getSelectedDay?.id"
      @close="isDaysPanelOpen = false"
      @select-day="setCurrentDay"
      @add-new-day="handleAddNewDay"
    />

    <Teleport to="body">
      <div
        ref="fixedLeftControlsRef"
        class="fixed-controls-container"
        :class="{ 'is-visible': showFixedControls }"
        :style="fixedLeftControlsStyle"
      >
        <div class="left-controls">
          <button
            v-if="!isDaysPanelPinned"
            class="menu-btn"
            title="Открыть меню дней"
            @click="isDaysPanelOpen = !isDaysPanelOpen"
          >
            <Icon icon="mdi:menu" />
          </button>

          <div v-if="isDayInfoLoading" class="current-day-info-skeleton">
            <KitSkeleton width="100px" height="20px" border-radius="6px" type="wave" />
            <KitSkeleton width="80px" height="18px" border-radius="6px" type="wave" />
          </div>
          <CalendarPopover v-else v-model="selectedCalendarDate" :disabled="isViewMode">
            <template #trigger>
              <div class="current-day-info" role="button" :class="{ readonly: isViewMode }">
                <h3 v-if="getSelectedDay">
                  {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }}
                </h3>
                <span v-if="getSelectedDay">
                  {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { weekday: 'long' }) }}
                </span>
              </div>
            </template>
          </CalendarPopover>
        </div>
      </div>
      <div
        ref="fixedRightControlsRef"
        class="fixed-controls-container"
        :class="{ 'is-visible': showFixedControls }"
        :style="fixedRightControlsStyle"
      >
        <div v-if="!isDayInfoLoading" class="right-controls">
          <button
            v-if="canEdit"
            class="mode-button"
            :title="isViewMode ? 'Перейти в режим редактирования' : 'Перейти в режим просмотра'"
            @click="toggleMode"
          >
            <Icon :icon="isViewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" />
          </button>

          <div class="view-controls">
            <ViewSwitcher />
            <button
              v-if="canEdit && mdAndUp"
              class="split-view-btn"
              title="Отобразить План и Воспоминания"
              :class="{ 'is-active': activeView === 'split' }"
              @click="store.ui.setActiveView('split')"
            >
              <Icon icon="mdi:view-split-vertical" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 8px;
  min-height: 80px;
  margin: 0 auto;
}
.left-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.right-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.spacer {
  flex-grow: 1;
}

.menu-btn {
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.delete-day-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  font-size: 1.2rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-error-color);
    color: var(--fg-error-color);
    border-color: var(--border-error-color);
  }
}

.mode-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  font-size: 1.2rem;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.current-day-info-skeleton {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.current-day-info {
  cursor: pointer;
  h3 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    font-family: 'Sansation';
  }
  span {
    color: var(--fg-secondary-color);
    text-transform: capitalize;
    font-family: 'Sansation';
    font-family: 500x;
  }
  &.readonly {
    cursor: default;
    pointer-events: none;
  }
}

.view-controls {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;

  :deep(.kit-view-switcher) {
    border: none;
    border-radius: 0;
  }
}

.split-view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  padding: 14px 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  font-size: 1.2rem;
  transition: all 0.2s ease;
  border-left: 1px solid var(--border-secondary-color);

  &:hover {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    background-color: var(--bg-accent-color-translucent);
    color: var(--fg-accent-color);
  }
}

.fixed-controls-container {
  position: fixed;
  z-index: 5;
  backdrop-filter: blur(4px);
  border-radius: var(--r-xs);
  padding: 8px;
  transition:
    top 0.3s ease,
    opacity 0.3s ease,
    transform 0.3s ease;
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
}
</style>
