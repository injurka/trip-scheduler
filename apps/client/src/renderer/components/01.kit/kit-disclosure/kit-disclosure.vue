<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

interface Props {
  label: string
  icon?: string
  description?: string
  count?: number
  compact?: boolean
}

defineProps<Props>()

const open = ref(false)

function onToggle(event: Event) {
  open.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

<template>
  <details class="kit-disclosure" :class="{ 'is-compact': compact }" @toggle="onToggle">
    <summary class="kit-disclosure-trigger">
      <Icon
        v-if="icon"
        :icon="icon"
        class="kit-disclosure-icon"
        aria-hidden="true"
      />
      <span class="kit-disclosure-copy">
        <span class="kit-disclosure-label">{{ label }}</span>
        <span v-if="description" class="kit-disclosure-description">{{ description }}</span>
      </span>
      <span v-if="count !== undefined" class="kit-disclosure-count">{{ count }}</span>
      <Icon icon="mdi:chevron-down" class="kit-disclosure-chevron" aria-hidden="true" />
    </summary>
    <slot :open="open" />
  </details>
</template>

<style scoped lang="scss">
.kit-disclosure {
  min-width: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-primary-color);
}
.kit-disclosure-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  box-sizing: border-box;
  border-radius: inherit;
  color: var(--fg-primary-color);
  cursor: pointer;
  list-style: none;

  &::marker {
    content: '';
  }
  &::-webkit-details-marker {
    display: none;
  }
  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }
}
.kit-disclosure-copy {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}
.kit-disclosure-label {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.kit-disclosure-description,
.kit-disclosure-count {
  color: var(--fg-secondary-color);
  font-size: 0.875em;
}
.kit-disclosure-count {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-secondary-color);
  font-variant-numeric: tabular-nums;
}
.kit-disclosure-icon,
.kit-disclosure-chevron {
  flex: none;
  font-size: 1.125rem;
}
.kit-disclosure-icon {
  color: var(--fg-accent-color);
}
.kit-disclosure-chevron {
  color: var(--fg-secondary-color);
}
.kit-disclosure[open] > summary .kit-disclosure-chevron {
  transform: rotate(180deg);
}
.is-compact {
  border: 0;
  background: none;

  > summary {
    width: fit-content;
    min-height: 32px;
    padding: 2px 0;
    color: var(--fg-secondary-color);
  }
}
</style>
