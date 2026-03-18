<script setup lang="ts">
import type { NoteTreeNode, SortMode } from '../../composables/use-notes-section'
import type { NoteType } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, ref } from 'vue'
import draggable from 'vuedraggable'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  nodes: NoteTreeNode[]
  activeId: string | null
  readonly: boolean
  sortMode: SortMode
  parentId?: string | null
  depth?: number
}

const props = withDefaults(defineProps<Props>(), {
  parentId: null,
  depth: 0,
})

const emit = defineEmits<{
  select: [id: string]
  createIn: [parentId: string | null, type: NoteType]
  delete: [id: string]
  rename: [id: string, title: string]
  updateColor: [id: string, color: string | null]
  updateList: [parentId: string | null, nodes: NoteTreeNode[]]
}>()

const expandedFolders = ref(new Set<string>())
const renamingId = ref<string | null>(null)
const renameTitle = ref('')
const openDropdownId = ref<string | null>(null)

// Используем get/set для VueDraggable. При перетаскивании он полностью
// заменяет массив нужного уровня, что мы и отдаем наверх.
const localNodes = computed({
  get: () => props.nodes,
  set: (newNodes) => {
    if (props.sortMode !== 'manual')
      return
    emit('updateList', props.parentId ?? null, newNodes)
  },
})

function toggleFolder(id: string): void {
  if (expandedFolders.value.has(id))
    expandedFolders.value.delete(id)
  else expandedFolders.value.add(id)
}

function isFolderExpanded(id: string): boolean {
  return expandedFolders.value.has(id)
}

function handleNodeClick(node: NoteTreeNode): void {
  if (node.type === 'folder')
    toggleFolder(node.id)
  else emit('select', node.id)
}

function getIcon(node: NoteTreeNode): string {
  if (node.type === 'folder')
    return isFolderExpanded(node.id) ? 'mdi:folder-open-outline' : 'mdi:folder-outline'
  if (node.type === 'excalidraw')
    return 'mdi:draw'
  return 'mdi:file-document-outline'
}

function startRename(node: NoteTreeNode): void {
  openDropdownId.value = null
  renamingId.value = node.id
  renameTitle.value = node.title
  nextTick(() => {
    const el = document.getElementById(`rename-input-${node.id}`)
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.select()
    }
  })
}

function commitRename(id: string): void {
  const trimmed = renameTitle.value.trim()
  if (trimmed && trimmed !== props.nodes.find(n => n.id === id)?.title) {
    emit('rename', id, trimmed)
  }
  renamingId.value = null
}

function cancelRename(): void {
  renamingId.value = null
}
</script>

<template>
  <draggable
    v-model="localNodes"
    item-key="id"
    :group="{ name: 'notes', pull: true, put: true }"
    :disabled="readonly || sortMode !== 'manual'"
    ghost-class="ghost-node"
    drag-class="dragging-node"
    class="tree-list"
    :delay="250"
    :delay-on-touch-only="true"
    :touch-start-threshold="5"
    :class="{ 'is-empty': nodes.length === 0 && parentId }"
    :style="nodes.length === 0 && parentId ? { '--empty-depth': `${depth * 16 + 8}px` } as any : {}"
  >
    <template #item="{ element: node }">
      <div class="tree-node">
        <div
          class="node-content"
          :class="{ 'is-active': activeId === node.id }"
          :style="{ paddingLeft: `${depth * 16 + 8}px` }"
          @click="handleNodeClick(node)"
          @contextmenu.prevent="!readonly && (openDropdownId = node.id)"
        >
          <Icon :icon="getIcon(node)" class="node-icon" :class="node.type" />

          <input
            v-if="renamingId === node.id"
            :id="`rename-input-${node.id}`"
            v-model="renameTitle"
            class="rename-input"
            @keydown.enter.prevent="commitRename(node.id)"
            @keydown.escape.prevent="cancelRename"
            @blur="commitRename(node.id)"
            @click.stop
          >
          <span v-else class="node-title" @dblclick.stop="!readonly && startRename(node)">
            {{ node.title }}
          </span>

          <div v-if="node.color" class="node-color-marker" :style="{ backgroundColor: node.color }" />

          <KitDropdown
            v-if="!readonly"
            align="end"
            class="node-actions"
            :open="openDropdownId === node.id"
            @update:open="(val) => openDropdownId = val ? node.id : null"
          >
            <!-- ... Шаблон KitDropdown без изменений ... -->
            <template #trigger>
              <button class="action-btn" @click.stop>
                <Icon icon="mdi:dots-vertical" />
              </button>
            </template>
            <div class="menu-content">
              <template v-if="node.type === 'folder'">
                <button @click.stop="emit('createIn', node.id, 'markdown')">
                  <Icon icon="mdi:file-document-plus-outline" /> Новая заметка
                </button>
                <button @click.stop="emit('createIn', node.id, 'excalidraw')">
                  <Icon icon="mdi:draw-pen" width="20" height="20" /> Новый скетч
                </button>
                <div class="menu-divider" />
              </template>
              <button @click.stop="startRename(node)">
                <Icon icon="mdi:pencil-outline" /> Переименовать
              </button>
              <button class="danger" @click.stop="emit('delete', node.id)">
                <Icon icon="mdi:trash-can-outline" /> Удалить
              </button>
              <div class="menu-divider" />
              <div class="color-picker" @click.stop>
                <button class="color-btn none" title="Без метки" @click="emit('updateColor', node.id, null)">
                  <Icon icon="mdi:close" />
                </button>
                <button class="color-btn" style="background-color: #ef4444" title="Важное" @click="emit('updateColor', node.id, '#ef4444')" />
                <button class="color-btn" style="background-color: #eab308" title="Черновик" @click="emit('updateColor', node.id, '#eab308')" />
                <button class="color-btn" style="background-color: #22c55e" title="Готово" @click="emit('updateColor', node.id, '#22c55e')" />
                <button class="color-btn" style="background-color: #3b82f6" title="Инфо" @click="emit('updateColor', node.id, '#3b82f6')" />
              </div>
            </div>
          </KitDropdown>
        </div>

        <div v-if="node.type === 'folder' && isFolderExpanded(node.id)" class="node-children">
          <NotesTree
            :nodes="node.children"
            :active-id="activeId"
            :readonly="readonly"
            :sort-mode="sortMode"
            :parent-id="node.id"
            :depth="depth + 1"
            @select="id => emit('select', id)"
            @create-in="(id, type) => emit('createIn', id, type)"
            @delete="id => emit('delete', id)"
            @rename="(id, title) => emit('rename', id, title)"
            @update-color="(id, color) => emit('updateColor', id, color)"
            @update-list="(p, n) => emit('updateList', p, n)"
          />
        </div>
      </div>
    </template>
  </draggable>
</template>

<style scoped lang="scss">
.tree-list {
  display: flex;
  flex-direction: column;
  min-height: 10px;
  margin-bottom: 4px;

  &.is-empty {
    min-height: 34px;
    margin: 2px 0;
    border: 1px dashed var(--border-secondary-color);
    border-radius: var(--r-s);
    background-color: rgba(var(--bg-hover-color-rgb), 0.3);
    transition: all 0.2s ease;
    display: flex;
    justify-content: center;

    &:empty::after {
      content: 'Вложить файл...';
      height: 100%;
      padding-left: calc(var(--empty-depth, 8px) + 6px);
      font-size: 0.8rem;
      padding-top: 4px;
      color: var(--fg-tertiary-color);
      pointer-events: none;
    }

    &:not(:empty) {
      border-color: var(--fg-accent-color);
      background-color: var(--bg-accent-overlay-color);
      border-style: solid;
    }
  }
}

.tree-node {
  display: flex;
  flex-direction: column;
}

.node-content {
  display: flex;
  align-items: center;

  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--r-s);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;

  .excalidraw {
    height: auto;
    width: auto;
  }

  :deep(.action-btn) {
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &:hover {
    background-color: var(--bg-hover-color);

    :deep(.action-btn) {
      opacity: 1;
    }
  }

  &.is-active {
    background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.3);
    color: var(--fg-accent-color);
  }
}

.node-icon {
  flex-shrink: 0;
  font-size: 1.05rem;
  color: var(--fg-secondary-color);
}

.node-title {
  flex: 1;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-color-marker {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.rename-input {
  flex: 1;
  font-size: 0.875rem;
  padding: 3px 4px;
  border: 1px solid var(--fg-accent-color);
  border-radius: var(--r-xs);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  outline: none;
  min-width: 0;
}

.node-actions {
  flex-shrink: 0;

  :deep(.action-btn) {
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    padding: 0;
    border-radius: var(--r-xs);
    transition: all 0.15s;

    &:hover {
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }
}

.menu-content {
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 160px;

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: transparent;
    border: none;
    text-align: left;
    border-radius: var(--r-xs);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    width: 100%;
    transition: background-color 0.15s;

    &:hover {
      background: var(--bg-hover-color);
    }

    &.danger {
      color: var(--fg-error-color);
    }

    .iconify {
      font-size: 1rem;
      flex-shrink: 0;
    }
  }
}

.menu-divider {
  height: 1px;
  background: var(--border-secondary-color);
  margin: 4px 0;
}

.color-picker {
  display: flex;
  gap: 8px;
  padding: 8px;
  justify-content: center;

  .color-btn {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.15);
      background: var(--bg-hover-color) !important;
    }

    &.none {
      background: transparent;
      color: var(--fg-tertiary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-secondary-color);

      .iconify {
        font-size: 12px;
        margin: 0;
      }
    }
  }
}

.ghost-node {
  opacity: 0.4;
  background: var(--bg-accent-overlay-color);
  border-radius: var(--r-s);
}

.dragging-node {
  opacity: 0.9;
  box-shadow: var(--shadow-m, 0 4px 16px rgba(0, 0, 0, 0.15));
  border-radius: var(--r-s);
}
</style>
