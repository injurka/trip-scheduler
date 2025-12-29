<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="timeline-skeleton">
    <div v-for="i in 3" :key="i" class="stage-skeleton">
      <div class="connector-column">
        <KitSkeleton width="24px" height="24px" border-radius="50%" />
        <KitSkeleton v-if="i < 3" width="2px" height="100%" />
      </div>
      <div class="stage-content">
        <KitSkeleton width="200px" height="28px" class="mb-3" />
        <div class="blocks-skeleton">
          <KitSkeleton width="95%" height="40px" />
          <KitSkeleton width="100%" height="220px" border-radius="var(--r-m)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
  gap: 12px;
}
.mb-3 {
  margin-bottom: 12px;
}
</style>
