<script setup lang="ts">
import { Icon } from '@iconify/vue'

const emit = defineEmits<{
  (e: 'add'): void
}>()
</script>

<template>
  <div class="add-day-activity">
    <button class="add-button" @click="emit('add')">
      <Icon icon="mdi:plus" />
      <span>Добавить активность</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.add-day-activity {
  margin: 32px 0;
  display: flex;
  justify-content: center;

  .add-button {
    width: 100%;
    padding: 12px;
    background-color: transparent;
    border: 2px dashed var(--border-secondary-color);
    color: var(--fg-secondary-color);
    border-radius: var(--r-s);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 500;

    &:hover {
      background-color: var(--bg-hover-color);
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }
  }
}
</style>
