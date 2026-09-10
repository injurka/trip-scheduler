<script setup lang="ts">
import type { DocumentFolder, DocumentSortOption, DocumentViewMode } from '../../models/types'
import { Icon } from '@iconify/vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'

interface SortOption {
  id: DocumentSortOption
  label: string
  icon: string
}

interface Props {
  currentFolder: DocumentFolder | null
  count: number
  sortOption: DocumentSortOption
  sortOptions: SortOption[]
  viewMode: DocumentViewMode
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:sortOption', val: DocumentSortOption): void
  (e: 'update:viewMode', val: DocumentViewMode): void
}>()

const currentSortLabel = computed(() => {
  return props.sortOptions.find(o => o.id === props.sortOption)?.label || 'Сортировка'
})
</script>

<template>
  <div class="docs-header-bar">
    <div class="section-subtitle">
      <Icon icon="mdi:file-document-multiple-outline" width="16" height="16" />
      <span>
        {{ currentFolder ? `Файлы в «${currentFolder.name}»` : 'Все документы' }}
        ({{ count }})
      </span>
    </div>

    <!-- Контролы отображения над списком файлов -->
    <div v-if="count > 0" class="docs-view-controls">
      <!-- Дропдаун сортировки -->
      <KitDropdown align="end" :items="[]">
        <template #trigger>
          <button class="sort-trigger-btn" :title="`Сортировка: ${currentSortLabel}`">
            <Icon icon="mdi:sort-variant" width="16" height="16" />
            <span class="sort-label">{{ currentSortLabel }}</span>
            <Icon icon="mdi:chevron-down" width="14" height="14" />
          </button>
        </template>
        <div class="sort-dropdown-menu">
          <button
            v-for="opt in sortOptions"
            :key="opt.id"
            class="sort-menu-item"
            :class="{ 'is-active': sortOption === opt.id }"
            @click="emit('update:sortOption', opt.id)"
          >
            <Icon :icon="opt.icon" width="16" height="16" />
            <span>{{ opt.label }}</span>
            <Icon v-if="sortOption === opt.id" icon="mdi:check" width="14" height="14" class="check-mark" />
          </button>
        </div>
      </KitDropdown>

      <!-- Компактный переключатель вида: Сетка / Список -->
      <div class="compact-view-toggle">
        <KitTooltip text="Вид: Сетка">
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'is-active': viewMode === 'grid' }"
            @click="emit('update:viewMode', 'grid')"
          >
            <Icon icon="mdi:view-grid-outline" width="17" height="17" />
          </button>
        </KitTooltip>
        <KitTooltip text="Вид: Список">
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'is-active': viewMode === 'list' }"
            @click="emit('update:viewMode', 'list')"
          >
            <Icon icon="mdi:view-list-outline" width="17" height="17" />
          </button>
        </KitTooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.docs-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  min-height: 36px;

  .section-subtitle {
    margin-bottom: 0;
  }
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.docs-view-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sort-trigger-btn {
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

  @media (max-width: 600px) {
    .sort-label {
      display: none;
    }
  }
}

.sort-dropdown-menu {
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 180px;
}

.sort-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-xs);
  font-size: 0.85rem;
  color: var(--fg-primary-color);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    font-weight: 600;
    color: var(--fg-accent-color);
  }

  .check-mark {
    margin-left: auto;
  }
}

.compact-view-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 2px;
  gap: 2px;

  .view-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--r-xs);
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: var(--fg-primary-color);
    }

    &.is-active {
      background-color: var(--bg-primary-color);
      color: var(--fg-accent-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
}
</style>
