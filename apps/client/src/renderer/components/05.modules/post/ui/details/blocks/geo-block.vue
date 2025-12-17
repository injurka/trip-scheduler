<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { vRipple } from '~/shared/directives/ripple'

interface Props {
  type: 'location' | 'route'
  title: string
  subtitle?: string
  icon?: string
}

defineProps<Props>()
</script>

<template>
  <button v-ripple class="geo-block">
    <div class="icon-box">
      <Icon :icon="icon || (type === 'route' ? 'mdi:map-marker-path' : 'mdi:map-marker')" />
    </div>
    <div class="info">
      <span class="geo-title">{{ title }}</span>
      <span v-if="subtitle" class="geo-subtitle">{{ subtitle }}</span>
    </div>
    <Icon icon="mdi:chevron-right" class="arrow" />
  </button>
</template>

<style scoped lang="scss">
.geo-block {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  margin: 8px 0;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
}

.icon-box {
  width: 36px;
  height: 36px;
  background: var(--bg-secondary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 1.2rem;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.geo-title {
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
}

.geo-subtitle {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.arrow {
  color: var(--fg-tertiary-color);
}
</style>
