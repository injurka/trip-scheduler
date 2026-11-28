<script setup lang="ts">
import type { DocumentFolder } from '../../models/types'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { formatBytes } from '../../constants'

interface Props {
  folders: DocumentFolder[]
  visibleFolders: DocumentFolder[]
  folderStats: Map<string, { count: number, sizeBytes: number }>
  readonly: boolean
  isAddingFolder: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'selectFolder', folderId: string): void
  (e: 'renameFolder', folder: DocumentFolder, newName: string): void
  (e: 'deleteFolder', folderId: string): void
  (e: 'createFolder', name: string): void
  (e: 'cancelCreateFolder'): void
}>()

const vFocus = {
  mounted: (el: HTMLElement) => el.focus(),
}
// Inline-редактирование существующей папки
const editingFolderId = ref<string | null>(null)
const editingFolderName = ref('')
// Inline-создание новой папки
const newFolderName = ref('')
const subfolderCounts = computed(() => {
  const counts = new Map<string, number>()

  for (const { parentId } of props.folders) {
    if (parentId)
      counts.set(parentId, (counts.get(parentId) ?? 0) + 1)
  }

  return counts
})

function startEditing(folder: DocumentFolder) {
  editingFolderId.value = folder.id
  editingFolderName.value = folder.name
}
function saveEditing(folder: DocumentFolder) {
  if (editingFolderName.value.trim() && editingFolderName.value !== folder.name) {
    emit('renameFolder', folder, editingFolderName.value.trim())
  }

  editingFolderId.value = null
  editingFolderName.value = ''
}
function cancelEditing() {
  editingFolderId.value = null
  editingFolderName.value = ''
}
function handleAddFolder() {
  if (newFolderName.value.trim()) {
    emit('createFolder', newFolderName.value.trim())
    newFolderName.value = ''
  }
  else {
    emit('cancelCreateFolder')
  }
}
</script>

<template>
  <div class="folders-block">
    <div class="section-subtitle">
      <span>Папки</span>
      <span v-if="visibleFolders.length" class="section-count">{{ visibleFolders.length }}</span>
    </div>

    <div class="folders-grid">
      <!-- Существующие папки -->
      <div
        v-for="folder in visibleFolders"
        :key="folder.id"
        class="folder-card"
        role="button"
        tabindex="0"
        :aria-label="`Открыть папку ${folder.name}`"
        @keydown.enter.self="emit('selectFolder', folder.id)"
        @keydown.space.prevent.self="emit('selectFolder', folder.id)"
        @click="emit('selectFolder', folder.id)"
      >
        <div class="folder-icon-wrapper">
          <Icon icon="mdi:folder-outline" width="20" height="20" />
        </div>

        <div class="folder-details">
          <!-- Просмотр или инлайн-редактирование имени -->
          <span
            v-if="editingFolderId !== folder.id"
            class="folder-name"
            :title="folder.name"
          >
            {{ folder.name }}
          </span>
          <input
            v-else
            v-model="editingFolderName"
            v-focus
            type="text"
            class="folder-name-input"
            @click.stop
            @blur="saveEditing(folder)"
            @keydown.enter="saveEditing(folder)"
            @keydown.esc="cancelEditing"
          >

          <span v-if="subfolderCounts.get(folder.id) || folderStats.get(folder.id)?.count" class="folder-stats">
            <span v-if="subfolderCounts.get(folder.id)">Папок: {{ subfolderCounts.get(folder.id) }}</span>
            <span v-if="folderStats.get(folder.id)?.count">Файлов: {{ folderStats.get(folder.id)?.count }} · {{ formatBytes(folderStats.get(folder.id)?.sizeBytes ?? 0) }}</span>
          </span>
          <span v-else class="folder-stats">
            Пусто
          </span>
        </div>

        <!-- Меню папки -->
        <div v-if="!readonly" class="folder-actions" @click.stop>
          <KitDropdown align="end" :items="[]">
            <template #trigger>
              <button class="folder-menu-btn" title="Опции папки">
                <Icon icon="mdi:dots-vertical" width="16" height="16" />
              </button>
            </template>
            <div class="sort-dropdown-menu">
              <button class="sort-menu-item" @click="startEditing(folder)">
                <Icon icon="mdi:pencil-outline" />
                <span>Переименовать</span>
              </button>
              <button class="sort-menu-item sort-menu-item--danger" @click="emit('deleteFolder', folder.id)">
                <Icon icon="mdi:trash-can-outline" />
                <span>Удалить папку</span>
              </button>
            </div>
          </KitDropdown>
        </div>
      </div>

      <!-- Создание новой папки -->
      <div v-if="isAddingFolder" class="folder-card new-folder-card">
        <div class="folder-icon-wrapper">
          <Icon icon="mdi:folder-plus-outline" width="20" height="20" />
        </div>
        <div class="folder-details">
          <input
            v-model="newFolderName"
            v-focus
            type="text"
            placeholder="Название папки..."
            class="folder-name-input"
            @blur="handleAddFolder"
            @keydown.enter="handleAddFolder"
            @keydown.esc="emit('cancelCreateFolder')"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.folders-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}
.section-count {
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 6px;
}

.folder-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  min-height: 52px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background-color: var(--bg-hover-color);

    .folder-menu-btn {
      opacity: 1;
    }
  }

  &.new-folder-card {
    border-style: dashed;
    background-color: transparent;
  }

  .folder-icon-wrapper {
    width: 24px;
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .folder-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex-grow: 1;
    gap: 2px;

    .folder-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .folder-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 8px;
      font-size: 0.72rem;
      color: var(--fg-secondary-color);
    }

    .folder-name-input {
      background: transparent;
      border: none;
      border-bottom: 1px dashed var(--fg-accent-color);
      outline: none;
      color: var(--fg-primary-color);
      font-size: 0.95rem;
      font-weight: 600;
      width: 100%;
      padding: 0;
    }
  }

  .folder-actions {
    margin-left: auto;
  }

  .folder-menu-btn {
    width: 26px;
    height: 26px;
    border-radius: var(--r-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
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

  &--danger {
    color: var(--fg-error-color);
    &:hover {
      background-color: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}
</style>
