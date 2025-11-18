<script setup lang="ts">
import type { UpdateTripInput } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useElementBounding, useIntersectionObserver, useWindowSize } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { TripEditInfoDialog } from '~/components/04.features/trip-info/trip-edit-info-dialog'
import { TripMapSection } from '~/components/04.features/trip-info/trip-map-section'
import { TripMemoriesView } from '~/components/04.features/trip-info/trip-memories'
import { TripPlanView } from '~/components/04.features/trip-info/trip-plan'
import { useDisplay } from '~/shared/composables/use-display'
import { useModuleStore } from '../composables/use-trip-info-module'
import SectionRenderer from './content/section-renderer.vue'
import TripOverviewContent from './content/trip-overview.vue'
import DayNavigation from './controls/day-navigation.vue'
import DaysControls from './controls/days-controls.vue'
import DayHeader from './day-header.vue'
import TripInfoEmpty from './states/trip-info-empty.vue'
import TripInfoSkeleton from './states/trip-info-skeleton.vue'

const route = useRoute()
const router = useRouter()

const { plan, ui, sections } = useModuleStore(['plan', 'ui', 'routeGallery', 'memories', 'sections'])
const { days, isLoading, fetchError, getPreviousDayId, getNextDayId } = storeToRefs(plan)
const { activeView } = storeToRefs(ui)

const tripId = computed(() => route.params.id as string)
const dayId = computed(() => route.query.day as string)
const sectionId = computed(() => route.query.section as string)
const isMapView = computed(() => route.query.view === 'map')

const isEditModalOpen = ref(false)

function handleEditTrip() {
  isEditModalOpen.value = true
}

function handleSaveTrip(updatedData: UpdateTripInput) {
  plan.updateTrip(updatedData)
}

watch(
  () => plan.currentDayId,
  (newDayId, oldDayId) => {
    if (newDayId && newDayId !== oldDayId) {
      ui.clearCollapsedState()
      nextTick(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
      })
    }

    if (newDayId && newDayId !== route.query.day) {
      router.replace({ query: { ...route.query, day: newDayId, section: undefined, view: undefined } })
    }
    else if (!newDayId && route.query.day) {
      // Handle case where day is deselected
      const newQuery = { ...route.query }
      delete newQuery.day
      router.replace({ query: newQuery })
    }
  },
)

watch(dayId, (newDayId) => {
  if (newDayId && newDayId !== plan.currentDayId) {
    plan.setCurrentDay(newDayId)
  }
  else if (!newDayId && plan.currentDayId && !sectionId.value && !isMapView.value) {
    plan.setCurrentDay('') // or null
  }
}, { immediate: true })

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

const showFixedNavButtons = computed(() => {
  return mdAndUp.value && freeSpaceOnSide.value >= 240 && !dayNavigationIsVisible.value
})

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
    >
      <template #loading>
        <TripInfoSkeleton />
      </template>

      <template #success>
        <TripMapSection v-if="isMapView" :days="days" />
        <template v-else>
          <!-- Вид "Обзор" (Визитка) -->
          <TripOverviewContent v-if="!dayId && !sectionId" :plan="plan" :sections="sections" @edit="handleEditTrip" />

          <!-- Вид "День" -->
          <template v-else-if="dayId && !sectionId">
            <DaysControls
              :wrapper-bounding="{
                left: wrapperLeft,
                width: wrapperWidth,
              }"
            />
            <div :key="plan.currentDayId!" class="trip-info-day-view">
              <KitDivider :is-loading="plan.isLoadingUpdateDay">
                о дне
              </KitDivider>
              <DayHeader />

              <div class="view-content" :class="`view-mode-${activeView}`">
                <TripPlanView v-if="activeView === 'plan' || activeView === 'split'" />
                <TripMemoriesView v-if="activeView === 'memories' || activeView === 'split'" />
              </div>

              <div ref="dayNavigationWrapperRef">
                <DayNavigation v-if="!isLoading && days.length > 1" />
              </div>
            </div>
          </template>

          <!-- Вид "Раздел" -->
          <SectionRenderer v-else-if="sectionId" />
        </template>

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

.view-content.view-mode-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.view-mode-split .plan-view::after {
  content: '';
  position: absolute;
  top: 0;
  right: -16px;
  bottom: 0;
  width: 1px;
  background-color: var(--border-secondary-color);
}

.trip-info-wrapper {
  height: 100%;
  position: relative;

  @include media-down(sm) {
    padding: 0 4px;
  }
}

.drop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--fg-accent-color-rgb), 0.1);
  border: 2px dashed var(--fg-accent-color);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  backdrop-filter: blur(4px);

  &-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--fg-accent-color);
    font-size: 1.2rem;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

    .iconify {
      font-size: 3rem;
    }
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
</style>
