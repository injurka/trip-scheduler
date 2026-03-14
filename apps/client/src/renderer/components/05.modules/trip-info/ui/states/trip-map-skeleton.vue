<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="map-skeleton-wrapper">
    <KitSkeleton width="100%" height="100%" border-radius="var(--r-m)" />

    <div class="floating-sidebar-skeleton">
      <KitSkeleton width="100%" height="32px" border-radius="6px" style="margin-bottom: 16px;" />
      <KitSkeleton v-for="i in 4" :key="i" width="100%" height="40px" border-radius="6px" style="margin-bottom: 8px;" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.map-skeleton-wrapper {
  position: relative;
  width: 100%;
  height: 70vh;
  min-height: calc(100vh - 150px);
  margin-top: 16px;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

.floating-sidebar-skeleton {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 320px;
  height: calc(100% - 32px);
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85);
  border: 1px solid rgba(var(--border-secondary-color-rgb), 0.5);
  border-radius: var(--r-l);
  padding: 16px;
  z-index: 2;

  @include media-down(sm) {
    display: none;
  }
}
</style>
