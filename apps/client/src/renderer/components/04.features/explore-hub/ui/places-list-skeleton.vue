<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="places-list-grid">
    <div v-for="i in 6" :key="i" class="skeleton-card">
      <KitSkeleton height="180px" />
      <div class="skeleton-content">
        <KitSkeleton width="60%" height="20px" />
        <KitSkeleton width="90%" height="16px" />
        <KitSkeleton width="80%" height="16px" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.places-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}
.skeleton-card {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
}
.skeleton-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
