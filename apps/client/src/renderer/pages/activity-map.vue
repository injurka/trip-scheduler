<script setup lang="ts">
import { ActivityMap } from '~/components/05.modules/activity-map'
import DayMemoriesPlayer from '~/components/05.modules/activity-map/ui/memories/day-memories-player.vue'
import TrackingToggle from '~/components/05.modules/activity-map/ui/memories/tracking-toggle.vue'

const route = useRoute()

const isMapMode = ref(route.query.view === 'map')
const isMemoriesMode = ref(route.query.view === 'memories')

function handleModeChange(mode: 'list' | 'map') {
  isMapMode.value = mode === 'map'
}
</script>

<template>
  <section
    class="content-wrapper"
    :class="{ 'is-map-mode': isMapMode || isMemoriesMode }"
  >
    <template v-if="isMemoriesMode">
      <TrackingToggle />
      <DayMemoriesPlayer class="memories-full" />
    </template>
    <ActivityMap
      v-else
      @mode-change="handleModeChange"
    />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
}
</style>
