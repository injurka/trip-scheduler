<script setup lang="ts">
import type { ChecklistGroup, ChecklistItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitEditable } from '~/components/01.kit/kit-editable'
import ChecklistIconPicker from './checklist-icon-picker.vue'
import ChecklistItemComponent from './checklist-item.vue'

interface Props {
  group: ChecklistGroup
  items: ChecklistItem[]
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:group', value: ChecklistGroup): void
  (e: 'update:items', value: ChecklistItem[]): void
  (e: 'delete'): void
  (e: 'addItem', text: string): void
}>()

const newItemText = ref('')
const isIconPickerOpen = ref(false)
const isCollapsed = ref(false)
const newItemInputRef = ref<HTMLInputElement | null>(null) // Ref для инпута

const groupProgress = computed(() => {
  if (!props.items)
    return { completed: 0, total: 0, percentage: 0 }
  const total = props.items.length
  if (total === 0)
    return { completed: 0, total: 0, percentage: 0 }

  const completed = props.items.filter(item => item.completed).length
  return { completed, total, percentage: Math.round((completed / total) * 100) }
})

function handleUpdateGroup(key: keyof ChecklistGroup, value: any) {
  emit('update:group', { ...props.group, [key]: value })
}

function handleUpdateItem(updatedItem: ChecklistItem) {
  const newItems = [...props.items]
  const index = newItems.findIndex(i => i.id === updatedItem.id)
  if (index !== -1) {
    newItems[index] = updatedItem
    emit('update:items', newItems)
  }
}

function handleDeleteItem(id: string) {
  emit('update:items', props.items.filter(i => i.id !== id))
}

function onAddItem() {
  if (newItemText.value.trim()) {
    emit('addItem', newItemText.value)
    newItemText.value = ''
    // Авто-фокус
    newItemInputRef.value?.focus()
  }
}
</script>

<template>
  <div class="checklist-group">
    <header class="group-header" @click.self="isCollapsed = !isCollapsed">
      <div class="title-container">
        <button v-if="!readonly" class="drag-handle-group" title="Перетащить группу">
          <Icon icon="mdi:drag" />
        </button>
        <button class="group-icon-btn" :disabled="readonly" @click="isIconPickerOpen = true">
          <Icon :icon="group.icon" class="group-icon" />
        </button>
        <KitEditable
          :model-value="group.name"
          :readonly="readonly"
          class="group-name"
          @update:model-value="handleUpdateGroup('name', $event)"
        />
      </div>
      <div class="header-actions">
        <div v-if="groupProgress.total > 0" class="group-progress-container" :title="`${groupProgress.percentage}% выполнено`">
          <span class="group-progress-text">
            {{ groupProgress.completed }} / {{ groupProgress.total }}
          </span>
          <div class="progress-bar-bg">
            <div class="progress-bar" :style="{ width: `${groupProgress.percentage}%` }" />
          </div>
        </div>
        <button v-if="!readonly" class="delete-group-btn" title="Удалить группу" @click="$emit('delete')">
          <Icon icon="mdi:trash-can-outline" />
        </button>
        <button class="collapse-btn" title="Свернуть/Развернуть" @click="isCollapsed = !isCollapsed">
          <Icon icon="mdi:chevron-down" :class="{ 'is-collapsed': isCollapsed }" />
        </button>
      </div>
    </header>

    <div v-show="!isCollapsed" class="group-content">
      <draggable
        :model-value="items"
        item-key="id"
        handle=".drag-handle"
        ghost-class="ghost-item-inner"
        :disabled="readonly"
        class="items-list"
        group="checklist-items"
        @update:model-value="emit('update:items', $event)"
      >
        <template #item="{ element: item }">
          <ChecklistItemComponent
            :item="item"
            :readonly="readonly"
            @update:item="handleUpdateItem"
            @delete="handleDeleteItem(item.id)"
          />
        </template>
      </draggable>

      <form v-if="!readonly" class="add-item-form" @submit.prevent="onAddItem">
        <input
          ref="newItemInputRef"
          v-model="newItemText"
          type="text"
          placeholder="Добавить задачу..."
          class="add-item-input"
        >
        <KitBtn type="submit" size="sm" :disabled="!newItemText.trim()">
          Ok
        </KitBtn>
      </form>
    </div>

    <ChecklistIconPicker
      v-model:visible="isIconPickerOpen"
      :current-icon="group.icon"
      @select="icon => handleUpdateGroup('icon', icon)"
    />
  </div>
</template>

<style scoped lang="scss">
.checklist-group {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  display: flex;
  flex-direction: column;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  background-color: var(--bg-tertiary-color);
  cursor: pointer;
  border-radius: var(--r-m);
}

.title-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-grow: 1;
  min-width: 0;
}

.drag-handle-group {
  cursor: grab;
  color: var(--fg-tertiary-color);
  &:active {
    cursor: grabbing;
  }
}

.group-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--r-s);
  transition: background-color 0.2s;
  &:not(:disabled):hover {
    background-color: var(--bg-hover-color);
  }
}

.group-icon {
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
}

.group-name {
  font-weight: 600;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Стили для нового прогресс-бара группы */
.group-progress-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-secondary-color);
  padding: 3px 8px;
  border-radius: var(--r-full);
}
.group-progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}
.progress-bar-bg {
  width: 50px;
  height: 6px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background-color: var(--fg-success-color);
  border-radius: var(--r-full);
  transition: width 0.3s ease;
}

.delete-group-btn,
.collapse-btn {
  color: var(--fg-tertiary-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transition: all 0.2s;
  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.delete-group-btn:hover {
  color: var(--fg-error-color);
}
.collapse-btn:hover {
  color: var(--fg-primary-color);
}

.collapse-btn svg {
  transition: transform 0.2s ease-in-out;
  &.is-collapsed {
    transform: rotate(-180deg);
  }
}

.group-content {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ghost-item-inner {
  opacity: 0.5;
  background: var(--bg-hover-color);
  border-radius: var(--r-s);
}

.add-item-form {
  display: flex;
  gap: 0.5rem;
  padding: 4px;
}

.add-item-input {
  flex-grow: 1;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  padding: 0.25rem;
  &:focus {
    outline: none;
    background: var(--bg-tertiary-color);
    border-radius: var(--r-xs);
  }
}
</style>
