<script setup lang="ts">
import { KitWipBadge } from '~/components/01.kit/kit-wip-badge'
import { ActivityMap } from '~/components/05.modules/activity-map'

const route = useRoute()

const isMapMode = ref(route.query.view === 'map')

function handleModeChange(mode: 'list' | 'map') {
  isMapMode.value = mode === 'map'
}
</script>

<template>
  <section
    class="content-wrapper"
    :class="{ 'is-map-mode': isMapMode }"
  >
    <KitWipBadge />
    <ActivityMap @mode-change="handleModeChange" />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 1400px;
  height: 100%;
  min-height: calc(100vh - 53px);

  &.is-map-mode {
    max-width: 100%;
    padding: 0;
    margin: 0;
    height: calc(100vh - 53px);
    overflow: hidden;
  }
}
</style>
