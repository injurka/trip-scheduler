<script setup lang="ts">
import type { BookingKindMeta } from '../../models/booking-kinds'
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  meta: BookingKindMeta
  size?: 'sm' | 'md'
}>(), {
  size: 'sm',
})
</script>

<template>
  <span
    class="booking-kind-badge"
    :class="[`is-${props.meta.token}`, `is-${props.size}`]"
    :title="props.meta.label"
  >
    <Icon :icon="props.meta.icon" class="kind-icon" />
    <span class="kind-label">{{ props.meta.label }}</span>
  </span>
</template>

<style scoped lang="scss">
.booking-kind-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--r-full);
  border: 1px solid currentColor;
  background-color: var(--bg-primary-color);
  color: var(--fg-tertiary-color);
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;

  &.is-sm {
    font-size: 0.7rem;
    padding: 1px 6px;
    line-height: 1.4;
  }

  &.is-md {
    font-size: 0.8rem;
    padding: 3px 10px;
    line-height: 1.4;
  }

  .kind-icon {
    flex-shrink: 0;
  }

  .kind-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.is-accent {
    color: var(--fg-accent-color);
  }

  &.is-info {
    color: var(--fg-info-color);
  }

  &.is-success {
    color: var(--fg-success-color);
  }

  &.is-warning {
    color: var(--fg-warning-color);
  }

  &.is-action {
    color: var(--fg-action-color);
  }

  &.is-muted {
    color: var(--fg-tertiary-color);
  }

  &.is-muted-strong {
    color: var(--fg-secondary-color);
  }
}
</style>
