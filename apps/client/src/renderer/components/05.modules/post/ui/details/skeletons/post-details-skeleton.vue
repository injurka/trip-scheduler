<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="post-details-skeleton">
    <!-- Skeleton for Hero -->
    <KitSkeleton height="400px" width="100%" class="hero-skeleton" />

    <div class="content-container">
      <!-- Skeleton for Sticky Nav -->
      <div class="sticky-nav-skeleton">
        <KitSkeleton v-for="i in 3" :key="i" width="80px" height="28px" border-radius="99px" />
      </div>

      <!-- Skeleton for Timeline -->
      <div class="timeline-skeleton">
        <div v-for="i in 2" :key="i" class="stage-skeleton">
          <div class="connector-column">
            <KitSkeleton width="24px" height="24px" border-radius="50%" />
            <KitSkeleton width="2px" height="100%" />
          </div>
          <div class="stage-content">
            <KitSkeleton width="150px" height="24px" class="mb-3" />
            <div class="blocks-skeleton">
              <KitSkeleton width="90%" height="60px" />
              <KitSkeleton width="100%" height="180px" border-radius="var(--r-m)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-details-skeleton {
  width: 100%;
}
.hero-skeleton {
  border-radius: 0 0 var(--r-xl) var(--r-xl);
  margin-bottom: 24px;
}
.content-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 8px;
}
.sticky-nav-skeleton {
  display: flex;
  gap: 8px;
  padding: 8px;
  margin-bottom: 24px;
  border-radius: var(--r-xl);
  border: 1px solid var(--border-secondary-color);
}
.timeline-skeleton {
  margin-top: 16px;
}
.stage-skeleton {
  display: flex;
  gap: 16px;
  padding-bottom: 32px;
}
.connector-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.stage-content {
  flex-grow: 1;
}
.blocks-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mb-3 {
  margin-bottom: 16px;
}
</style>
