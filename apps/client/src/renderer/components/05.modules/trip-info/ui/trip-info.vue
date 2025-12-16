<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useElementBounding, useIntersectionObserver, useWindowSize } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { TripEditInfoDialog } from '~/components/04.features/trip-info/trip-edit-info-dialog'
import { TripMemoriesView } from '~/components/04.features/trip-info/trip-memories'
import { DayMetaBadges, TripPlanView } from '~/components/04.features/trip-info/trip-plan'
import { useDisplay } from '~/shared/composables/use-display'
import { useModuleStore } from '../composables/use-trip-info-module'
import { useTripInfoView } from '../composables/use-trip-info-view'
import SectionRenderer from './content/section-renderer.vue'
import TripOverviewContent from './content/trip-overview.vue'
import DayNavigation from './controls/day-navigation.vue'
import DaysControls from './controls/days-controls.vue'
import DayHeader from './day-header.vue'
import TripInfoEmpty from './states/trip-info-empty.vue'
import TripInfoSkeleton from './states/trip-info-skeleton.vue'

const {
  tripId,
  dayId,
  resolvedSectionId,
  sectionQuery,
  init,
  handleSaveTrip,
} = useTripInfoView()

init()

const { plan, ui, sections } = useModuleStore(['plan', 'ui', 'sections'])
const { days, isLoading, fetchError, getPreviousDayId, getNextDayId, getSelectedDay } = storeToRefs(plan)
const { activeView, isViewMode } = storeToRefs(ui)

const isEditModalOpen = ref(false)

function handleEditTrip() {
  isEditModalOpen.value = true
}

// --- UI Controls & Fixed Navigation ---
const { mdAndUp } = useDisplay()
const tripInfoWrapperRef = ref<HTMLElement | null>(null)
const dayNavigationWrapperRef = ref<HTMLElement | null>(null)
const dayNavigationIsVisible = ref(true)

const { stop: stopIntersectionObserver } = useIntersectionObserver(
  dayNavigationWrapperRef,
  ([{ isIntersecting }]) => {
    dayNavigationIsVisible.value = isIntersecting
  },
)

const { width: windowWidth, height: windowHeight } = useWindowSize()
const { left: wrapperLeft, width: wrapperWidth, bottom: wrapperBottom } = useElementBounding(tripInfoWrapperRef)

const freeSpaceOnSide = computed(() => wrapperLeft.value)
const showFixedNavButtons = computed(() => mdAndUp.value && freeSpaceOnSide.value >= 240 && !dayNavigationIsVisible.value)
const isDayMetaBadges = computed(() => !!(getSelectedDay.value && (getSelectedDay.value.meta?.length || !isViewMode.value)))

const fixedNavPrevBtnStyle = computed(() => ({
  bottom: `${Math.max(20, windowHeight.value - wrapperBottom.value)}px`,
  left: `${wrapperLeft.value - 240}px`,
}))

const fixedNavNextBtnStyle = computed(() => ({
  bottom: `${Math.max(20, windowHeight.value - wrapperBottom.value)}px`,
  right: `${windowWidth.value - (wrapperLeft.value + wrapperWidth.value) - 240}px`,
}))

function handleSelectPreviousDay() {
  plan.selectPreviousDay()
}

function handleSelectNextDay() {
  plan.selectNextDay()
}

onUnmounted(() => {
  stopIntersectionObserver()
})
</script>

<template>
  <div ref="tripInfoWrapperRef" class="trip-info-wrapper">
    <AsyncStateWrapper
      :loading="isLoading || plan.isLoadingNewDay"
      :error="fetchError"
      :data="days"
      :retry-handler="() => plan.fetchTripDetails(tripId, dayId, sections.setSections)"
      transition="slide-up"
      class="trip-info-async-wrapper"
    >
      <template #loading>
        <TripInfoSkeleton />
      </template>

      <template #success>
        <!-- 1. Вид "Обзор" -->
        <TripOverviewContent v-if="!dayId && !sectionQuery" :plan="plan" :sections="sections" @edit="handleEditTrip" />

        <!-- 2. Вид "День" -->
        <template v-else-if="dayId && !sectionQuery">
          <DaysControls
            :wrapper-bounding="{
              left: wrapperLeft,
              width: wrapperWidth,
            }"
          />
          <div :key="plan.currentDayId!" class="trip-info-day-view">
            <KitDivider :is-loading="plan.isLoadingUpdateDay || plan.isLoadingUpdateDay">
              о дне
            </KitDivider>
            <DayHeader />

            <div class="view-content">
              <Transition name="fade-view" mode="out-in">
                <TripPlanView
                  v-if="activeView === 'plan'"
                >
                  <template #footer>
                    <KitDivider v-if="getSelectedDay?.meta?.length || !isViewMode">
                      мета-информация
                    </KitDivider>

                    <DayMetaBadges
                      v-if="isDayMetaBadges"
                      :meta="getSelectedDay!.meta || []"
                      :readonly="isViewMode"
                      @update:meta="newMeta => plan.updateDayDetails(getSelectedDay!.id, { meta: newMeta })"
                    />
                  </template>
                </TripPlanView>

                <TripMemoriesView v-else-if="activeView === 'memories'" />
              </Transition>
            </div>

            <div ref="dayNavigationWrapperRef">
              <DayNavigation v-if="!isLoading && days.length > 1" />
            </div>
          </div>
        </template>

        <!-- 3. Вид "Раздел" (включая Карту) -->
        <SectionRenderer
          v-else-if="resolvedSectionId"
          :section-id="resolvedSectionId"
          :days="days"
        />

        <TripEditInfoDialog
          v-if="isEditModalOpen"
          v-model:visible="isEditModalOpen"
          :trip="plan.trip"
          @save="handleSaveTrip"
        />
      </template>

      <template #empty>
        <TripInfoEmpty />
      </template>
    </AsyncStateWrapper>
  </div>

  <!-- Fixed Navigation Buttons -->
  <Teleport to="body">
    <Transition name="fade">
      <KitBtn
        v-if="showFixedNavButtons && dayId"
        variant="outlined"
        color="secondary"
        class="fixed-nav-btn prev"
        :style="fixedNavPrevBtnStyle"
        :disabled="!getPreviousDayId"
        @click="handleSelectPreviousDay"
      >
        <Icon icon="mdi:chevron-left" />
        Предыдущий день
      </KitBtn>
    </Transition>
    <Transition name="fade">
      <KitBtn
        v-if="showFixedNavButtons && dayId"
        variant="outlined"
        color="secondary"
        class="fixed-nav-btn next"
        :style="fixedNavNextBtnStyle"
        :disabled="!getNextDayId"
        @click="handleSelectNextDay"
      >
        Следующий день
        <Icon icon="mdi:chevron-right" />
      </KitBtn>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.trip-info-day-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.trip-info-wrapper {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;

  @include media-down(sm) {
    padding: 0 4px;
  }
}

:deep(.trip-info-async-wrapper) {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;

  .async-state-wrapper-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
  }
}

.fixed-nav-btn {
  position: fixed;
  z-index: 5;
  width: 200px;
  justify-content: center;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.7);
  backdrop-filter: blur(4px);
  padding: 10px 16px;

  &:not(:disabled):hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  :deep(.iconify) {
    font-size: 1.2rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.fade-view-enter-active,
.fade-view-leave-active {
  transition: opacity 0.2s ease;
}
.fade-view-enter-from,
.fade-view-leave-to {
  opacity: 0;
}
</style>
