<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="travel-card-wrapper">
    <div class="travel-card">
      <div class="card-image-container">
        <KitSkeleton width="60%" height="28px" class="card-title-skeleton" />
      </div>

      <div class="card-content">
        <div class="card-meta">
          <div class="meta-item-skeleton">
            <KitSkeleton width="24px" height="24px" border-radius="50%" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="40%" height="20px" color="var(--bg-tertiary-color)" />
          </div>
          <div class="meta-item-skeleton">
            <KitSkeleton width="24px" height="24px" border-radius="50%" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="60%" height="20px" color="var(--bg-tertiary-color)" />
          </div>
          <div class="meta-item-skeleton">
            <KitSkeleton width="24px" height="24px" border-radius="50%" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="70%" height="20px" color="var(--bg-tertiary-color)" />
          </div>
        </div>

        <div class="card-footer">
          <div class="card-participants-skeleton">
            <KitSkeleton width="32px" height="32px" border-radius="50%" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="32px" height="32px" border-radius="50%" class="avatar-overlap" color="var(--bg-tertiary-color)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.travel-card-wrapper {
  padding: 0;
  border-radius: var(--r-xl);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.travel-card {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  box-shadow: var(--s-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

.card-image-container {
  position: relative;
  height: 200px;
  width: 100%;
  padding: 12px 16px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  background-color: var(--bg-tertiary-color);
}

.card-title-skeleton {
  z-index: 2;
}

.card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-grow: 1;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meta-item-skeleton {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}

.card-participants-skeleton {
  display: flex;
  align-items: center;

  .avatar-overlap {
    margin-left: -8px;
  }
}
</style>
