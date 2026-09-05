<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ActivityMap } from '~/components/05.modules/activity-map'

const route = useRoute()
const isMapMode = ref(route.query.view === 'map')

watch(() => route.query.view, (view) => {
  if (view === 'map' || view === 'list') {
    isMapMode.value = view === 'map'
  }
})

function handleModeChange(mode: 'list' | 'map') {
  isMapMode.value = mode === 'map'
}
</script>

<template>
  <section
    class="content-wrapper"
    :class="{ 'is-map-mode': isMapMode }"
  >
    <ActivityMap
      @mode-change="handleModeChange"
    />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  position: relative;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  padding: 16px;
  max-width: 1400px;
  min-height: calc(100vh - var(--header-actual-height, var(--header-height, 53px)));

  &.is-map-mode {
    max-width: 100%;
    padding: 0;
    margin: 0;
    flex: 1;
    height: 100%;
    max-height: 100%;
    overflow: hidden;

    :global(html.is-tauri) & {
      padding-top: var(--header-actual-height, var(--header-height)) !important;
    }
  }
}
</style>
