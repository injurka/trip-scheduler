<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="generic-section-skeleton">
    <div class="toolbar-skeleton">
      <div class="toolbar-left">
        <KitSkeleton width="180px" height="36px" border-radius="8px" />
        <KitSkeleton width="120px" height="36px" border-radius="8px" />
      </div>
      <div class="toolbar-right">
        <KitSkeleton width="200px" height="36px" border-radius="8px" />
      </div>
    </div>

    <div class="grid-skeleton">
      <div v-for="i in 6" :key="i" class="card-skeleton">
        <KitSkeleton width="100%" height="120px" border-radius="8px" style="margin-bottom: 12px;" />
        <KitSkeleton width="70%" height="20px" border-radius="4px" style="margin-bottom: 8px;" />
        <KitSkeleton width="40%" height="16px" border-radius="4px" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.generic-section-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  margin-top: 16px;
}

.toolbar-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    gap: 12px;
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;

    .toolbar-left,
    .toolbar-right {
      width: 100%;
      > * {
        flex: 1;
      }
    }
  }
}

.grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;

  .card-skeleton {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 16px;
  }
}
</style>
