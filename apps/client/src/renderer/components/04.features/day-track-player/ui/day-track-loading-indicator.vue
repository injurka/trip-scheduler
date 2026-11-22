<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <div class="map-loading" role="status">
    <div class="map-loading-label">
      <Icon icon="mdi:map-outline" aria-hidden="true" />
      <span>Загружаем карту</span>
    </div>
    <div class="map-loading-track" aria-hidden="true" />
  </div>
</template>

<style scoped lang="scss">
.map-loading {
  width: 100%;
  padding: 9px 12px 10px;
  border-radius: var(--r-s);
  background: color-mix(in srgb, var(--fg-accent-color) 9%, var(--bg-secondary-color));
}

.map-loading-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--fg-primary-color);
  font-size: 0.85rem;
  font-weight: 600;

  svg {
    color: var(--fg-accent-color);
    font-size: 1.1rem;
  }
}

.map-loading-track {
  height: 3px;
  margin-top: 8px;
  border-radius: var(--r-full);
  overflow: hidden;
  background: color-mix(in srgb, var(--fg-accent-color) 18%, var(--bg-secondary-color));

  &::after {
    display: block;
    width: 38%;
    height: 100%;
    border-radius: inherit;
    background: var(--fg-accent-color);
    content: '';
    animation: map-loading-sweep 1.6s ease-in-out infinite;
  }
}

@keyframes map-loading-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(264%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .map-loading-track::after {
    margin-inline: auto;
    animation: none;
  }
}
</style>
