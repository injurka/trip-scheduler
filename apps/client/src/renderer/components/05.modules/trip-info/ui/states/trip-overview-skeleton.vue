<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="trip-overview-skeleton">
    <!-- Banner Skeleton -->
    <div class="overview-banner-skeleton">
      <div class="banner-content-skeleton">
        <KitSkeleton width="70%" height="40px" border-radius="8px" />
        <KitSkeleton width="50%" height="20px" border-radius="6px" />
      </div>
      <div class="banner-footer-skeleton">
        <div class="footer-meta-skeleton">
          <div class="meta-item-skeleton">
            <KitSkeleton width="24px" height="24px" border-radius="4px" />
            <KitSkeleton width="100px" height="20px" border-radius="4px" />
          </div>
          <div class="meta-item-skeleton">
            <KitSkeleton width="24px" height="24px" border-radius="4px" />
            <KitSkeleton width="80px" height="20px" border-radius="4px" />
          </div>
        </div>
        <div class="participants-skeleton">
          <KitSkeleton v-for="i in 4" :key="i" width="36px" height="36px" border-radius="50%" />
        </div>
      </div>
    </div>

    <!-- Description Skeleton -->
    <div class="description-skeleton">
      <KitSkeleton width="90%" height="18px" border-radius="4px" />
      <KitSkeleton width="70%" height="18px" border-radius="4px" />
    </div>

    <!-- Widgets Skeleton -->
    <div class="info-widgets-skeleton">
      <div class="widget-skeleton">
        <div class="main-stats-skeleton">
          <div v-for="i in 3" :key="i" class="stat-item-skeleton">
            <KitSkeleton width="48px" height="48px" border-radius="50%" />
            <KitSkeleton width="60px" height="24px" border-radius="4px" />
            <KitSkeleton width="40px" height="16px" border-radius="4px" />
          </div>
        </div>
      </div>
      <div class="widget-skeleton">
        <KitSkeleton width="180px" height="20px" border-radius="6px" style="margin-bottom: 16px;" />
        <KitSkeleton width="100%" height="40px" border-radius="8px" style="margin-bottom: 24px;" />
        <div style="display: flex; justify-content: space-around; align-items: center;">
          <KitSkeleton width="50px" height="50px" border-radius="4px" />
          <KitSkeleton width="80px" height="80px" border-radius="4px" />
          <KitSkeleton width="50px" height="50px" border-radius="4px" />
        </div>
      </div>
    </div>

    <!-- Lists Skeleton -->
    <div class="overview-grid-skeleton">
      <div class="overview-section-skeleton">
        <KitSkeleton width="40%" height="28px" border-radius="6px" style="margin-bottom: 24px;" />
        <div class="list-items-skeleton">
          <KitSkeleton v-for="i in 4" :key="i" width="100%" height="48px" border-radius="8px" />
        </div>
      </div>
      <div class="overview-section-skeleton">
        <KitSkeleton width="30%" height="28px" border-radius="6px" style="margin-bottom: 24px;" />
        <div class="list-items-skeleton">
          <KitSkeleton v-for="i in 2" :key="i" width="100%" height="48px" border-radius="8px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.trip-overview-skeleton {
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.overview-banner-skeleton {
  position: relative;
  height: 380px;
  border-radius: var(--r-l);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background-color: var(--bg-secondary-color);
  padding: 1.5rem;
}

.banner-content-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 2;
  margin-bottom: 1rem;
}

.banner-footer-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background-color: rgba(var(--bg-primary-color-rgb), 0.4);
  backdrop-filter: blur(10px);
  padding: 1rem 1.5rem;
  border-radius: var(--r-m);
  z-index: 2;
}

.footer-meta-skeleton {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.meta-item-skeleton {
  display: flex;
  align-items: center;
  gap: 8px;
}

.participants-skeleton {
  display: flex;
  :deep(.kit-skeleton) {
    margin-left: -12px;
    border: 2px solid var(--bg-secondary-color);
  }
}

.description-skeleton {
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-widgets-skeleton,
.overview-grid-skeleton {
  display: grid;
  gap: 1.5rem;
}

.info-widgets-skeleton {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.widget-skeleton,
.overview-section-skeleton {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
}

.main-stats-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 1rem 0.5rem;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
}

.list-items-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
