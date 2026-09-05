<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <div class="activity-empty-state">
    <div class="empty-icon-wrap">
      <Icon icon="mdi:radar" class="empty-icon" />
    </div>
    <h3 class="empty-title">
      Маршрутов пока нет
    </h3>
    <p class="empty-hint">
      Включите переключатель фонового GPS-трекинга выше, и ваши перемещения начнут автоматически сохраняться и отображаться на карте воспоминаний.
    </p>
  </div>
</template>

<style scoped lang="scss">
.activity-empty-state {
  text-align: center;
  padding: var(--p-2xl) var(--p-m);
  color: var(--fg-secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-s);
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);

  .empty-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: var(--r-full);
    background-color: var(--bg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-accent-color);

    .empty-icon {
      font-size: 2rem;
    }
  }

  .empty-title {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .empty-hint {
    max-width: 440px;
    font-size: 0.88rem;
    line-height: 1.45;
    margin: 0;
  }
}
</style>
