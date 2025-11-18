<script setup lang="ts">
import type { TripFilters } from '../../composables/use-trips-hub'
import KitBtn from '~/components/01.kit/kit-btn/ui/kit-btn.vue'
import { KitInput } from '~/components/01.kit/kit-input'

const filters = defineModel<TripFilters>('filters', { required: true })
const isOpen = defineModel<boolean>('isOpen', { default: false })

const { mdAndUp } = useDisplay()
</script>

<template>
  <div class="main-controls">
    <KitInput
      v-if="mdAndUp"
      v-model="filters.search"
      icon="mdi:magnify"
      placeholder="Поиск по названию..."
      class="search-input"
      aria-label="Поиск по названию"
    />
    <KitBtn
      icon="mdi:filter-multiple-outline"
      variant="outlined"
      aria-label="Фильтры"
      class="search-filter-btn"
      :class="{ 'is-active': isOpen }"
      @click="isOpen = !isOpen"
    />
  </div>
</template>

<style lang="scss" scoped>
.main-controls {
  display: flex;
  gap: 16px;
  height: 46px;
}

.search-input {
  max-width: 300px;
  width: 100%;

  :deep(input) {
    border: 1px solid var(--border-secondary-color);
  }
}

.search-filter-btn {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s ease;
  flex-shrink: 0; // Предотвращаем сжатие кнопки

  &.is-active {
    border-color: var(--border-accent-color);
    color: var(--fg-accent-color);
    background-color: var(--bg-accent-color);
  }
}
</style>
