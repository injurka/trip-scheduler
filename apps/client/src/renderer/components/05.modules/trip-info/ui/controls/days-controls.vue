<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { IDay } from '../../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { useElementBounding, useIntersectionObserver, useWindowSize } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useDisplay } from '~/shared/composables/use-display'
import { useToast } from '~/shared/composables/use-toast'
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
const { isDaysPanelPinned, isDaysPanelOpen, isViewMode } = storeToRefs(store.ui)
const { getAllDays, getSelectedDay, isLoading, isLoadingNewDay } = storeToRefs(store.plan)
const { setCurrentDay, updateDayDetails, deleteDay } = store.plan
const appStore = useAppStore(['layout'])
const { isHeaderVisible, headerHeight } = storeToRefs(appStore.layout)
const { canEdit } = useTripPermissions()
const confirm = useConfirm()
const toast = useToast()

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

function handleAddNewDraftDay() {
  store.plan.addNewDraftDay()
  if (!store.ui.isDaysPanelPinned)
    store.ui.closeDaysPanel()
}

async function handleDeleteDay() {
  const isDraft = !getSelectedDay.value?.date
  const isConfirmed = await confirm({
    title: isDraft ? 'Удалить черновик дня?' : 'Удалить текущий день?',
    description: 'Это действие необратимо. Все активности, связанные с этим днем, будут удалены.',
    type: 'danger',
    confirmText: 'Удалить',
  })
  if (isConfirmed)
    deleteDay()
}

function handleUnassignDay() {
  if (!getSelectedDay.value)
    return
  updateDayDetails(getSelectedDay.value.id, { date: null })
  toast.info('Маршрут отвязан от даты и перемещен в черновики.')
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
    return getSelectedDay.value && getSelectedDay.value.date
      ? parseDate(getSelectedDay.value.date.split('T')[0])
      : null
  },
  set: (newDate) => {
    if (!newDate || !getSelectedDay.value)
      return

    const currentDay = getSelectedDay.value
    const originalDate = currentDay.date
    const newDateString = newDate.toString() // 'YYYY-MM-DD'

    if (originalDate && originalDate.startsWith(newDateString))
      return

    const newIsoDate = new Date(newDateString).toISOString()

    const occupiedDay = getAllDays.value.find(
      (day: IDay) => day.date && day.date.startsWith(newDateString) && day.id !== currentDay.id,
    )

    if (occupiedDay) {
      updateDayDetails(occupiedDay.id, { date: originalDate })
      updateDayDetails(currentDay.id, { date: newIsoDate })

      if (!originalDate) {
        toast.info(`Маршрут назначен на ${new Date(newDateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}. Прежний маршрут дня перемещен в черновики.`)
      }
      else {
        toast.info('Маршруты дней поменялись местами.')
      }
    }
    else {
      updateDayDetails(currentDay.id, { date: newIsoDate })
      toast.success(`Маршрут назначен на ${new Date(newDateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`)
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
        <KitTooltip v-if="!isDaysPanelPinned" text="Открыть меню дней">
          <button
            class="menu-btn"
            @click="isDaysPanelOpen = !isDaysPanelOpen"
          >
            <Icon icon="mdi:menu" />
          </button>
        </KitTooltip>

        <div v-if="isDayInfoLoading" class="current-day-info-skeleton">
          <KitSkeleton width="100px" height="20px" border-radius="6px" type="wave" />
          <KitSkeleton width="80px" height="18px" border-radius="6px" type="wave" />
        </div>
        <CalendarPopover
          v-else
          v-model="selectedCalendarDate"
          :disabled="isViewMode"
        >
          <template #trigger>
            <div
              class="current-day-info"
              role="button"
              :class="{ 'readonly': isViewMode, 'is-draft': !getSelectedDay?.date }"
            >
              <template v-if="getSelectedDay?.date">
                <h3>
                  {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }}
                </h3>
                <span>
                  {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { weekday: 'long' }) }}
                </span>
              </template>
              <template v-else-if="getSelectedDay">
                <div class="draft-badge-row">
                  <Icon icon="mdi:calendar-question" />
                  <h3>Без даты</h3>
                </div>
                <span class="draft-action-hint">{{ isViewMode ? 'Черновик маршрута' : 'Нажмите, чтобы назначить день' }}</span>
              </template>
            </div>
          </template>
          <template #footer>
            <KitBtn
              v-if="!isViewMode && !!getSelectedDay && !!getSelectedDay.date"
              variant="text"
              size="sm"
              class="unassign-btn"
              title="Переместить в черновики (отвязать от даты)"
              @click="handleUnassignDay"
            >
              <Icon width="16" icon="mdi:archive-arrow-down-outline" />
              <span>В черновики</span>
            </KitBtn>
            <div class="spacer" />
            <KitBtn
              v-if="!isViewMode && !!getSelectedDay"
              variant="text"
              size="sm"
              class="delete-btn"
              title="Удалить день"
              @click="handleDeleteDay"
            >
              <Icon width="18" icon="mdi:trash-can-outline" />
            </KitBtn>
          </template>
        </CalendarPopover>
      </div>
      <div class="spacer" />
      <div v-if="!isDayInfoLoading" class="right-controls">
        <div class="view-controls">
          <ViewSwitcher />
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
      @add-new-draft-day="handleAddNewDraftDay"
    />

    <Teleport to="body">
      <div
        ref="fixedLeftControlsRef"
        class="fixed-controls-container"
        :class="{ 'is-visible': showFixedControls }"
        :style="fixedLeftControlsStyle"
      >
        <div class="left-controls">
          <KitTooltip v-if="!isDaysPanelPinned" text="Открыть меню дней">
            <button
              class="menu-btn"
              @click="isDaysPanelOpen = !isDaysPanelOpen"
            >
              <Icon icon="mdi:menu" />
            </button>
          </KitTooltip>

          <div v-if="isDayInfoLoading" class="current-day-info-skeleton">
            <KitSkeleton width="100px" height="20px" border-radius="6px" type="wave" />
            <KitSkeleton width="80px" height="18px" border-radius="6px" type="wave" />
          </div>
          <CalendarPopover
            v-else
            v-model="selectedCalendarDate"
            :disabled="isViewMode"
          >
            <template #trigger>
              <div
                class="current-day-info"
                role="button"
                :class="{ 'readonly': isViewMode, 'is-draft': !getSelectedDay?.date }"
              >
                <template v-if="getSelectedDay?.date">
                  <h3>
                    {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }}
                  </h3>
                  <span>
                    {{ new Date(getSelectedDay.date).toLocaleDateString('ru-RU', { weekday: 'long' }) }}
                  </span>
                </template>
                <template v-else-if="getSelectedDay">
                  <div class="draft-badge-row">
                    <Icon icon="mdi:calendar-question" />
                    <h3>Без даты</h3>
                  </div>
                  <span class="draft-action-hint">{{ isViewMode ? 'Черновик маршрута' : 'Нажмите, чтобы назначить день' }}</span>
                </template>
              </div>
            </template>
            <template #footer>
              <KitBtn
                v-if="!isViewMode && !!getSelectedDay && !!getSelectedDay.date"
                variant="text"
                size="sm"
                class="unassign-btn"
                title="Переместить в черновики (отвязать от даты)"
                @click="handleUnassignDay"
              >
                <Icon width="16" icon="mdi:archive-arrow-down-outline" />
                <span>В черновики</span>
              </KitBtn>
              <div class="spacer" />
              <KitBtn
                v-if="!isViewMode && !!getSelectedDay"
                variant="text"
                size="sm"
                class="delete-btn"
                title="Удалить день"
                @click="handleDeleteDay"
              >
                <Icon width="18" icon="mdi:trash-can-outline" />
              </KitBtn>
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
          <KitTooltip v-if="canEdit" :text="isViewMode ? 'Перейти в режим редактирования' : 'Перейти в режим просмотра'">
            <button
              class="mode-button"
              @click="toggleMode"
            >
              <Icon :icon="isViewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" />
            </button>
          </KitTooltip>

          <div class="view-controls">
            <ViewSwitcher />
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
  display: flex;
  flex-direction: column;

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
    font-weight: 500;
  }
  &.readonly {
    cursor: default;
    pointer-events: none;
  }

  &.is-draft {
    .draft-badge-row {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--fg-accent-color);

      .iconify {
        font-size: 1.3rem;
      }

      h3 {
        color: var(--fg-primary-color);
      }
    }

    .draft-action-hint {
      color: var(--fg-accent-color);
      font-size: 0.85rem;
      text-transform: none;
    }
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

.unassign-btn {
  color: var(--fg-secondary-color);
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: var(--fg-accent-color);
  }
}

.delete-btn {
  color: var(--fg-error-color);
  &:hover {
    background-color: var(--bg-error-color);
  }
}
</style>
