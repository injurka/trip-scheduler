<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="trip-overview-skeleton">
    <div class="overview-banner-skeleton">
      <!-- Top header bar skeleton -->
      <div class="banner-top-bar-skeleton">
        <KitSkeleton width="110px" height="28px" border-radius="var(--r-full)" />
        <KitSkeleton width="38px" height="38px" border-radius="var(--r-full)" />
      </div>

      <!-- Main banner content skeleton -->
      <div class="banner-body-skeleton">
        <KitSkeleton width="55%" height="2.5rem" class="title-skeleton" />

        <div class="meta-row-skeleton">
          <KitSkeleton width="140px" height="1.25rem" />
          <KitSkeleton width="70px" height="1.25rem" border-radius="var(--r-full)" />
          <KitSkeleton width="120px" height="1.25rem" />
          <KitSkeleton width="90px" height="1.25rem" border-radius="var(--r-s)" />
        </div>

        <div class="bottom-row-skeleton">
          <div class="bottom-row-left-skeleton">
            <div class="status-line-skeleton">
              <KitSkeleton width="110px" height="24px" border-radius="var(--r-full)" />
              <KitSkeleton width="90px" height="24px" border-radius="var(--r-full)" />
            </div>

            <div class="tags-skeleton">
              <KitSkeleton width="60px" height="22px" border-radius="var(--r-full)" />
              <KitSkeleton width="75px" height="22px" border-radius="var(--r-full)" />
              <KitSkeleton width="65px" height="22px" border-radius="var(--r-full)" />
            </div>
          </div>

          <div class="avatars-skeleton">
            <KitSkeleton width="34px" height="34px" border-radius="50%" />
            <KitSkeleton width="34px" height="34px" border-radius="50%" class="avatar-overlap" />
            <KitSkeleton width="34px" height="34px" border-radius="50%" class="avatar-overlap" />
          </div>
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
  min-height: 400px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  box-sizing: border-box;

  @include media-down(md) {
    min-height: 360px;
  }
}

.banner-top-bar-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  width: 100%;
  box-sizing: border-box;

  @include media-down(md) {
    padding: 1rem;

    :deep(> *:first-child) {
      width: 38px !important;
      height: 38px !important;
    }
  }
}

.banner-body-skeleton {
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;

  @include media-down(md) {
    padding: 1rem;
    gap: 10px;
  }
}

.status-line-skeleton {
  display: flex;
  gap: 8px;
}

.title-skeleton {
  margin: 4px 0;

  @include media-down(md) {
    width: 85% !important;
  }
}

.meta-row-skeleton {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.bottom-row-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border-secondary-color);

  @include media-down(md) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;

    .tags-skeleton {
      display: none;
    }
  }
}

.bottom-row-left-skeleton {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  flex: 1;
  min-width: 0;
}

.tags-skeleton {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.avatars-skeleton {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.avatar-overlap {
  margin-left: -8px;
  border: 2px solid var(--bg-secondary-color);
}

.description-skeleton {
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.info-widgets-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @include media-down(md) {
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
