<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="highlights-grid">
    <div
      v-for="i in 9"
      :key="i"
      class="skeleton-card"
      :style="{ height: `${250 + Math.random() * 200}px` }"
    >
      <KitSkeleton class="skeleton-media" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-grid {
  column-count: 3;
  column-gap: 6px;
  width: 100%;
}

.skeleton-card {
  display: inline-block;
  width: 100%;
  border-radius: var(--r-l);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  break-inside: avoid;
}

.skeleton-media {
  width: 100%;
  height: 100% !important;
  border-radius: 0;
}

@media (max-width: 1280px) {
  .highlights-grid {
    column-count: 2;
  }
}

@media (max-width: 768px) {
  .highlights-grid {
    column-count: 1;
  }
}
</style>
