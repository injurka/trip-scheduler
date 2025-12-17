<script setup lang="ts">
import type { PostCategory } from '../../models/types'
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { KitInput } from '~/components/01.kit/kit-input'
import { usePostStore } from '../../store/post.store'

const store = usePostStore()
const { filters } = storeToRefs(store)

const categories: { id: PostCategory, label: string, icon: string }[] = [
  { id: 'food', label: 'Еда', icon: 'mdi:food-fork-drink' },
  { id: 'nature', label: 'Природа', icon: 'mdi:tree' },
  { id: 'culture', label: 'Культура', icon: 'mdi:palette' },
  { id: 'sport', label: 'Спорт', icon: 'mdi:run' },
  { id: 'other', label: 'Разное', icon: 'mdi:dots-horizontal' },
]

function handleTabChange(tab: 'explore' | 'saved') {
  store.setTab(tab)
}
</script>

<template>
  <div class="filters-container">
    <!-- 1. Tabs & Search Row -->
    <div class="top-row">
      <div class="tabs-switch">
        <button
          class="tab-btn"
          :class="{ active: filters.tab === 'explore' }"
          @click="handleTabChange('explore')"
        >
          Обзор
        </button>
        <button
          class="tab-btn"
          :class="{ active: filters.tab === 'saved' }"
          @click="handleTabChange('saved')"
        >
          Сохраненное
        </button>
      </div>

      <div class="search-box">
        <KitInput
          v-model="filters.search"
          placeholder="Город, место или тег..."
          icon="mdi:magnify"
          size="sm"
        />
      </div>
    </div>

    <!-- 2. Categories Scroll -->
    <div class="categories-scroll">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="category-chip"
        :class="{ active: filters.category === cat.id }"
        @click="store.setCategory(cat.id)"
      >
        <Icon :icon="cat.icon" />
        <span>{{ cat.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filters-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 56px;
  z-index: 10;
  padding: 8px 0;
  backdrop-filter: blur(10px);
}

.top-row {
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 480px) {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}

.search-box {
  flex: 1;
}

/* Tabs Switch */
.tabs-switch {
  display: flex;
  background: var(--bg-secondary-color);
  padding: 4px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.tab-btn {
  padding: 6px 16px;
  border-radius: var(--r-s);
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  &:hover:not(.active) {
    color: var(--fg-primary-color);
  }
}

/* Categories Scroll */
.categories-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px; /* Space for shadow if needed */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.category-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-full);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  &.active {
    background: rgba(var(--fg-accent-color-rgb), 0.1);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}
</style>
