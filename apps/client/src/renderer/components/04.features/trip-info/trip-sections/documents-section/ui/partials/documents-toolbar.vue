<script setup lang="ts">
import type { DocumentCategory } from '../../models/types'
import { Icon } from '@iconify/vue'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { DOCUMENT_CATEGORIES } from '../../constants'

interface Props {
  searchQuery: string
  selectedCategory: DocumentCategory
  onlyFavorites: boolean
  favoritesCount: number
  categoryCounts: Map<DocumentCategory, number>
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void
  (e: 'update:selectedCategory', val: DocumentCategory): void
  (e: 'update:onlyFavorites', val: boolean): void
}>()
</script>

<template>
  <div class="filters-toolbar">
    <!-- Поле поиска -->
    <div class="search-box">
      <KitInput
        :model-value="searchQuery"
        placeholder="Поиск по названию или заметкам..."
        size="sm"
        clearable
        @update:model-value="val => emit('update:searchQuery', String(val ?? ''))"
      >
        <template #prepend>
          <Icon icon="mdi:magnify" width="16" height="16" class="search-icon" />
        </template>
      </KitInput>
    </div>

    <!-- Фильтр по категориям -->
    <div class="categories-filter">
      <button
        class="category-chip"
        :class="{ 'is-active': selectedCategory === 'all' }"
        @click="emit('update:selectedCategory', 'all')"
      >
        <span>Все</span>
      </button>

      <button
        v-for="cat in DOCUMENT_CATEGORIES"
        :key="cat.id"
        class="category-chip"
        :class="{ 'is-active': selectedCategory === cat.id }"
        @click="emit('update:selectedCategory', cat.id)"
      >
        <Icon :icon="cat.icon" width="14" height="14" :style="{ color: cat.color }" />
        <span>{{ cat.label }}</span>
        <span v-if="(categoryCounts.get(cat.id) || 0) > 0" class="chip-count">
          {{ categoryCounts.get(cat.id) }}
        </span>
      </button>
    </div>

    <!-- Быстрый фильтр: Избранное -->
    <div class="fav-toggle-box">
      <KitTooltip text="Показать только избранные документы">
        <button
          class="filter-toggle-btn fav-btn"
          :class="{ 'is-active': onlyFavorites }"
          @click="emit('update:onlyFavorites', !onlyFavorites)"
        >
          <Icon :icon="onlyFavorites ? 'mdi:star' : 'mdi:star-outline'" width="16" height="16" />
          <span v-if="favoritesCount > 0" class="counter-badge">
            {{ favoritesCount }}
          </span>
        </button>
      </KitTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filters-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.search-box {
  flex: 1;
  min-width: 200px;
  max-width: 320px;

  .search-icon {
    color: var(--fg-tertiary-color);
  }

  @media (max-width: 768px) {
    max-width: 100%;
  }
}

.categories-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 2;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.is-active {
    background-color: var(--fg-accent-color);
    color: #fff;
    border-color: var(--fg-accent-color);

    .chip-count {
      background-color: rgba(255, 255, 255, 0.25);
      color: #fff;
    }

    :deep(svg) {
      color: #fff !important;
    }
  }

  .chip-count {
    padding: 1px 6px;
    border-radius: 10px;
    background-color: var(--bg-secondary-color);
    color: var(--fg-tertiary-color);
    font-size: 0.72rem;
    font-weight: 600;
  }
}

.fav-toggle-box {
  flex-shrink: 0;
}

.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.fav-btn.is-active {
    border-color: #f59e0b;
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.1);
  }

  .counter-badge {
    padding: 1px 5px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    font-size: 0.7rem;
    font-weight: 700;
  }
}
</style>
