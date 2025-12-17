<script setup lang="ts">
import { TripInfo } from '~/components/05.modules/trip-info'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useDisplay } from '~/shared/composables/use-display'

const route = useRoute()
const isMapView = computed(() => route.query.section === 'map')

const store = useModuleStore(['plan', 'ui'])
const { mdAndDown } = useDisplay()

const { fetchError } = storeToRefs(store.plan)
const { isDaysPanelPinned, activeView, isParallelPlanView } = storeToRefs(store.ui)
</script>

<template>
  <section
    class="content-wrapper-inner"
    :class="[
      { isPanelPinned: isDaysPanelPinned && !mdAndDown },
      { 'has-error': fetchError },
      { 'is-map-view': isMapView },
      { 'is-wide-mode': isParallelPlanView },
      activeView,
    ]"
  >
    <TripInfo />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper-inner {
  &.is-map-view {
    max-width: 100%;
    padding: 0; 
    height: 100%; 
  }

  &.has-error {
    background: transparent;
  }

  &.isPanelPinned {
    @media (max-width: 1800px) {
      margin-left: 440px;
    }
  }

  &.is-wide-mode {
    max-width: 100%;
    justify-content: center;
    align-items: center;

    :deep() {
      .navigation-back-container,
      .controls,
      .day-header,
      .day-navigation,
      .divider-with-action {
        max-width: 1000px;
        width: 100%;
        margin-left: auto;
        margin-right: auto;
      }

      .divider-with-action {
        position: relative;
      }

      .trip-info-wrapper {
        .trip-info {
          justify-content: center;
          align-items: center;

          .divider {
            padding: 0 32px;
          }

          .view-content {
            padding: 0 32px;
            max-width: 1800px;
            margin: 0 auto;
            width: 100%;
          }
        }
      }
    }
  }
}
</style>
