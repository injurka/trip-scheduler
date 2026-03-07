<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { KitInput } from '~/components/01.kit/kit-input'
import { usePostStore } from '../../store/post.store'

const store = usePostStore()
const { filters } = storeToRefs(store)

function handleTabChange(tab: 'explore' | 'saved') {
  store.setTab(tab)
}
</script>

<template>
  <div class="filters-container">
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
  </div>
</template>

<style scoped lang="scss">
.filters-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
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
</style>
