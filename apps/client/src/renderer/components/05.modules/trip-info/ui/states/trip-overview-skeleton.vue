<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="trip-overview-skeleton">
    <div class="overview-banner-skeleton">
      <div class="banner-content-skeleton">
        <KitSkeleton width="60%" height="2.5rem" class="mb-4" />
        <div class="meta-line">
          <KitSkeleton width="100px" height="1.5rem" />
          <KitSkeleton width="100px" height="1.5rem" />
        </div>
      </div>
      <div class="banner-footer-skeleton">
        <div class="footer-top-row">
          <div class="footer-meta-left">
            <KitSkeleton width="110px" height="32px" border-radius="var(--r-s)" />
            <KitSkeleton width="90px" height="24px" />
          </div>

          <div class="footer-avatars">
            <KitSkeleton width="36px" height="36px" border-radius="50%" />
            <KitSkeleton width="36px" height="36px" border-radius="50%" class="avatar-overlap" />
          </div>
        </div>

        <div class="footer-tags-row">
          <KitSkeleton width="60px" height="24px" border-radius="var(--r-full)" />
          <KitSkeleton width="80px" height="24px" border-radius="var(--r-full)" />
          <KitSkeleton width="70px" height="24px" border-radius="var(--r-full)" />
          <KitSkeleton width="90px" height="24px" border-radius="var(--r-full)" />
          <KitSkeleton width="60px" height="24px" border-radius="var(--r-full)" />
        </div>
      </div>
    </div>

    <div class="description-skeleton">
      <KitSkeleton width="100%" height="1.2rem" class="mb-2" />
      <KitSkeleton width="80%" height="1.2rem" />
    </div>

    <div class="info-widgets-skeleton">
      <div class="widget-card">
        <div class="stats-row">
          <KitSkeleton height="80px" class="flex-1" border-radius="var(--r-m)" />
          <KitSkeleton height="80px" class="flex-1" border-radius="var(--r-m)" />
          <KitSkeleton height="80px" class="flex-1" border-radius="var(--r-m)" />
        </div>
        <KitSkeleton height="1px" width="100%" class="my-3" />
        <KitSkeleton height="40px" width="100%" border-radius="var(--r-m)" />
      </div>

      <div class="widget-card">
        <KitSkeleton width="150px" height="1.2rem" class="mb-3" />
        <KitSkeleton width="100%" height="36px" border-radius="var(--r-m)" class="mb-3" />
        <KitSkeleton width="100%" height="190px" border-radius="var(--r-m)" />
      </div>
    </div>

    <div class="overview-grid-skeleton">
      <div class="section-card">
        <div class="section-header">
          <KitSkeleton width="24px" height="24px" />
          <KitSkeleton width="100px" height="24px" />
        </div>
        <div class="list-skeleton">
          <div v-for="i in 5" :key="`day-${i}`" class="list-item-skeleton">
            <KitSkeleton width="28px" height="28px" border-radius="var(--r-s)" />
            <div class="item-content">
              <KitSkeleton width="80px" height="1rem" class="mb-1" />
              <KitSkeleton width="120px" height="0.8rem" />
            </div>
            <KitSkeleton width="24px" height="24px" class="ml-auto" />
          </div>
        </div>
      </div>
    </div>

    <div class="map-widget-skeleton">
      <div class="section-header">
        <KitSkeleton width="24px" height="24px" />
        <KitSkeleton width="100px" height="24px" />
        <div class="spacer" />
        <KitSkeleton width="100px" height="32px" border-radius="var(--r-m)" />
      </div>
      <KitSkeleton width="100%" height="400px" border-radius="var(--r-m)" />
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
  height: 380px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;

  @include media-down(md) {
    min-height: 300px;
    height: auto;
  }
}

.banner-content-skeleton {
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.meta-line {
  display: flex;
  gap: 1.5rem;
}

.banner-footer-skeleton {
  background-color: var(--bg-tertiary-color);
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @include media-down(sm) {
    padding: 1rem;
    gap: 1rem;
  }
}

.footer-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  @include media-down(xs) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

.footer-meta-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.footer-avatars {
  display: flex;
  flex-shrink: 0;
}

.avatar-overlap {
  margin-left: -10px;
  border: 2px solid var(--bg-secondary-color);
}

.footer-tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.footer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;

  @include media-down(sm) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

.badges {
  display: flex;
  gap: 1rem;
}

.avatars {
  display: flex;
}

.description-skeleton {
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.info-widgets-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.widget-card,
.section-card,
.map-widget-skeleton {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
}

.stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 0.5rem;
}

.flex-1 {
  flex: 1;
}

.ml-3 {
  margin-left: 0.75rem;
}

.ml-auto {
  margin-left: auto;
}

.mb-1 {
  margin-bottom: 0.25rem;
}
.mb-2 {
  margin-bottom: 0.5rem;
}
.mb-3 {
  margin-bottom: 0.75rem;
}
.mb-4 {
  margin-bottom: 1rem;
}
.my-3 {
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

.overview-grid-skeleton {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  align-items: start;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 1rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-secondary-color);
}

.list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-item-skeleton {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 12px 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;

  @include media-down(md) {
    width: 100%;
  }
}

.spacer {
  flex-grow: 1;
}

.digits-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.sep {
  font-size: 2rem;
  color: var(--fg-tertiary-color);
  opacity: 0.3;
}
</style>
