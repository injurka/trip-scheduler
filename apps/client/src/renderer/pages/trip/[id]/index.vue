<script setup lang="ts">
import { TripInfo } from '~/components/05.modules/trip-info'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useDisplay } from '~/shared/composables/use-display'

const route = useRoute()
const isMapView = computed(() => route.query.view === 'map')

const store = useModuleStore(['plan', 'ui'])
const { mdAndDown } = useDisplay()

const { fetchError } = storeToRefs(store.plan)
const { isDaysPanelPinned, activeView } = storeToRefs(store.ui)
</script>

<template>
  <section
    class="content-wrapper"
    :class="[
      { isPanelPinned: isDaysPanelPinned && !mdAndDown },
      { 'has-error': fetchError },
      { 'is-map-view': isMapView },
      activeView,
    ]"
  >
    <TripInfo />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  transition: background-color 0.2s ease;

  &.is-map-view {
    max-width: 1800px;
  }

  &.has-error {
    background: transparent;
  }

  &.isPanelPinned {
    @media (max-width: 1800px) {
      margin-left: 440px;
    }
  }

  &.split {
    max-width: 100%;
    justify-content: center;
    align-items: center;

    :deep() {
      .navigation-back-container,
      .controls {
        max-width: 968px;
        width: 100%;
      }

      .trip-info-wrapper {
        .trip-info {
          justify-content: center;
          align-items: center;

          .day-header {
            max-width: 968px;
            width: 100%;
          }

          .divider {
            padding: 0 32px;
          }

          .view-content {
            padding: 0 32px;
          }
        }
      }

      .day-navigation {
        max-width: 968px;
        width: 100%;
      }
    }
  }
}
</style>
