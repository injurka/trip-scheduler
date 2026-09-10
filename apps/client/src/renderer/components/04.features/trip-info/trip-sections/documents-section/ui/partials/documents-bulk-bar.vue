<script setup lang="ts">
import type { DocumentFolder } from '../../models/types'
import { Icon } from '@iconify/vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  selectedCount: number
  totalFilteredCount: number
  folders: DocumentFolder[]
  currentFolderId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'selectAll'): void
  (e: 'clearSelection'): void
  (e: 'deleteSelected'): void
  (e: 'moveSelected', targetFolderId: string | null): void
  (e: 'exitSelectionMode'): void
}>()
</script>

<template>
  <div class="bulk-action-bar">
    <div class="bulk-info">
      <Icon icon="mdi:check-circle" width="18" height="18" class="bulk-icon" />
      <span>Выбрано: <strong>{{ selectedCount }}</strong></span>
    </div>

    <div class="bulk-actions">
      <!-- Выбрать все / Снять выбор -->
      <button
        v-if="selectedCount < totalFilteredCount"
        class="bulk-btn"
        @click="emit('selectAll')"
      >
        <Icon icon="mdi:checkbox-multiple-marked-outline" width="16" height="16" />
        <span>Выбрать все ({{ totalFilteredCount }})</span>
      </button>

      <button
        v-if="selectedCount > 0"
        class="bulk-btn"
        @click="emit('clearSelection')"
      >
        <Icon icon="mdi:checkbox-blank-off-outline" width="16" height="16" />
        <span>Снять выбор</span>
      </button>

      <!-- Переместить в папку -->
      <KitDropdown v-if="selectedCount > 0 && folders.length > 0" align="end" :items="[]">
        <template #trigger>
          <button class="bulk-btn" title="Переместить выбранные файлы">
            <Icon icon="mdi:folder-move-outline" width="16" height="16" />
            <span>Переместить...</span>
            <Icon icon="mdi:chevron-down" width="14" height="14" />
          </button>
        </template>
        <div class="sort-dropdown-menu">
          <button
            v-if="currentFolderId !== null"
            class="sort-menu-item"
            @click="emit('moveSelected', null)"
          >
            <Icon icon="mdi:folder-home-outline" width="16" height="16" />
            <span>В корень (Все документы)</span>
          </button>

          <button
            v-for="folder in folders"
            :key="folder.id"
            class="sort-menu-item"
            :disabled="folder.id === currentFolderId"
            @click="emit('moveSelected', folder.id)"
          >
            <Icon icon="mdi:folder" width="16" height="16" />
            <span>{{ folder.name }}</span>
          </button>
        </div>
      </KitDropdown>

      <!-- Удалить выбранные -->
      <button
        v-if="selectedCount > 0"
        class="bulk-btn bulk-btn--danger"
        @click="emit('deleteSelected')"
      >
        <Icon icon="mdi:trash-can-outline" width="16" height="16" />
        <span>Удалить ({{ selectedCount }})</span>
      </button>

      <!-- Завершить выбор -->
      <button class="bulk-btn" @click="emit('exitSelectionMode')">
        <Icon icon="mdi:close" width="16" height="16" />
        <span>Готово</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bulk-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 14px;
  background-color: rgba(var(--fg-accent-color-rgb), 0.08);
  border: 1px solid var(--fg-accent-color);
  border-radius: var(--r-m);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bulk-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--fg-primary-color);

  .bulk-icon {
    color: var(--fg-accent-color);
  }
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &--danger {
    color: var(--fg-error-color);
    border-color: rgba(var(--fg-error-color-rgb), 0.3);

    &:hover {
      background-color: rgba(var(--fg-error-color-rgb), 0.1);
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

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
