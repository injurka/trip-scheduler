<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="activity-tracking-skeleton">
    <!-- Skeleton метрик -->
    <div class="skeleton-metrics">
      <div v-for="i in 3" :key="i" class="skeleton-metric-card">
        <KitSkeleton width="40px" height="40px" border-radius="var(--r-s)" />
        <div class="skeleton-metric-text">
          <KitSkeleton width="70px" height="22px" border-radius="var(--r-2xs)" />
          <KitSkeleton width="110px" height="14px" border-radius="var(--r-2xs)" />
        </div>
      </div>
    </div>

    <!-- Skeleton списка дней -->
    <div class="skeleton-days">
      <div v-for="i in 3" :key="i" class="skeleton-day-card">
        <div class="skeleton-card-head">
          <KitSkeleton width="130px" height="20px" border-radius="var(--r-2xs)" />
          <KitSkeleton width="90px" height="16px" border-radius="var(--r-2xs)" />
        </div>
        <KitSkeleton width="100%" height="42px" border-radius="var(--r-s)" />
        <KitSkeleton width="100%" height="6px" border-radius="var(--r-xs)" />
        <div class="skeleton-rows">
          <KitSkeleton width="60%" height="16px" border-radius="var(--r-2xs)" />
          <KitSkeleton width="45%" height="16px" border-radius="var(--r-2xs)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-tracking-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-m);
}

.skeleton-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--p-s);

  .skeleton-metric-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: var(--p-s) var(--p-m);
    display: flex;
    align-items: center;
    gap: var(--p-s);

    .skeleton-metric-text {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
  }
}

.skeleton-days {
  display: flex;
  flex-direction: column;
  gap: var(--p-s);

  .skeleton-day-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: var(--p-m);
    display: flex;
    flex-direction: column;
    gap: var(--p-s);

    .skeleton-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .skeleton-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 4px;
    }
  }
}
</style>
