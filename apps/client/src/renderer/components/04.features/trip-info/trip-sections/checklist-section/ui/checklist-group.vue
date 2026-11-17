<script setup lang="ts">
import type { ChecklistGroup, ChecklistItem } from '../models/types'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitEditable } from '~/components/01.kit/kit-editable'
import { vRipple } from '~/shared/directives/ripple'
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
const isCollapsed = ref(false)
const newItemInputRef = ref<HTMLInputElement | null>(null)

const groupProgress = computed(() => {
  if (!props.items)
    return { completed: 0, total: 0, percentage: 0 }

  const total = props.items.length

  if (total === 0)
    return { completed: 0, total: 0, percentage: 0 }

  const completed = props.items.filter(item => item.completed).length

  return { completed, total, percentage: Math.round((completed / total) * 100) }
})

const displayGroupName = computed(() => {
  if (!props.group.name)
    return ''

  const cleaned = props.group.name
    .replace(/^[\p{Extended_Pictographic}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
    .trim()

  return cleaned || props.group.name
})

function handleUpdateGroup(key: keyof ChecklistGroup, value: unknown) {
  emit('update:group', { ...props.group, [key]: value })
}

function handleUpdateGroupName(name: string) {
  const cleaned = name
    .replace(/^[\p{Extended_Pictographic}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
    .trim()
  handleUpdateGroup('name', cleaned || name)
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
    newItemInputRef.value?.focus()
  }
}
</script>

<template>
  <div class="checklist-group">
    <header
      v-ripple
      class="group-header"
      :class="{ 'is-readonly': readonly, 'has-items': groupProgress.total > 0 }"
      @click="isCollapsed = !isCollapsed"
    >
      <button
        v-if="!readonly"
        type="button"
        class="drag-handle-group"
        title="Перетащить группу"
        aria-label="Перетащить группу"
        @click.stop
      >
        <Icon icon="mdi:drag" />
      </button>
      <div class="title-container">
        <ChecklistIconPicker
          v-if="!readonly"
          :model-value="group.icon"
          :disabled="readonly"
          @click.stop
          @update:model-value="(icon: string) => handleUpdateGroup('icon', icon)"
        />
        <span v-else class="group-icon" aria-hidden="true">
          <Icon :icon="group.icon" width="20" height="20" />
        </span>
        <span
          v-if="readonly"
          class="group-name"
        >
          {{ displayGroupName }}
        </span>
        <KitEditable
          v-else
          :model-value="displayGroupName"
          :readonly="readonly"
          class="group-name"
          @click.stop
          @update:model-value="handleUpdateGroupName"
        />
      </div>
      <div class="header-actions">
        <div v-if="groupProgress.total > 0" class="group-progress-container" :title="`${groupProgress.percentage}% выполнено`">
          <span class="group-progress-text">
            {{ groupProgress.completed }} / {{ groupProgress.total }}
          </span>
        </div>
        <button
          v-if="!readonly"
          type="button"
          class="delete-group-btn"
          title="Удалить группу"
          aria-label="Удалить группу"
          @click.stop="$emit('delete')"
        >
          <Icon icon="mdi:trash-can-outline" />
        </button>
        <button
          type="button"
          class="collapse-btn"
          :title="isCollapsed ? 'Развернуть' : 'Свернуть'"
          :aria-label="isCollapsed ? 'Развернуть группу' : 'Свернуть группу'"
          :aria-expanded="!isCollapsed"
          :aria-controls="`checklist-group-${group.id}`"
          @click.stop="isCollapsed = !isCollapsed"
        >
          <Icon icon="mdi:chevron-down" :class="{ 'is-collapsed': isCollapsed }" />
        </button>
      </div>
    </header>

    <div v-show="!isCollapsed" :id="`checklist-group-${group.id}`" class="group-content">
      <draggable
        v-if="!readonly"
        :model-value="items"
        item-key="id"
        handle=".drag-handle"
        ghost-class="ghost-item-inner"
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

      <div v-else class="items-list">
        <ChecklistItemComponent
          v-for="item in items"
          :key="item.id"
          :item="item"
          :readonly="readonly"
          @update:item="handleUpdateItem"
          @delete="handleDeleteItem(item.id)"
        />
      </div>

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
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 28px 28px;
  grid-template-areas: 'drag title progress delete collapse';
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  background-color: var(--bg-tertiary-color);
  cursor: pointer;
  border-radius: var(--r-m);

  &.is-readonly {
    grid-template-columns: minmax(0, 1fr) auto 28px;
    grid-template-areas: 'title progress collapse';
  }
}

.title-container {
  grid-area: title;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-grow: 1;
  min-width: 0;
}

.group-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 36px;
  flex: 0 0 32px;
}

.drag-handle-group {
  grid-area: drag;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;

  cursor: grab;
  color: var(--fg-tertiary-color);

  &:active {
    cursor: grabbing;
  }
}

.group-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.4;
  font-weight: 600;
  font-size: 1rem;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.header-actions {
  display: contents;
}

.title-container > :not(.group-name) {
  flex-shrink: 0;
}

.group-name :deep(.kit-editable-controls) {
  flex-shrink: 0;
}

.group-name :deep(.kit-editable-area) {
  padding: 0;
}

.delete-group-btn {
  grid-area: delete;
}

.collapse-btn {
  grid-area: collapse;
}

/* Стили для нового прогресс-бара группы */
.group-progress-container {
  grid-area: progress;
  justify-self: start;
  white-space: nowrap;
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

.delete-group-btn,
.collapse-btn {
  padding: 0;
  border: 0;
  background: transparent;
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

@include media-down(sm) {
  .group-header {
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    grid-template-areas:
      'title title collapse'
      'drag progress delete';
    gap: 8px;
    padding: 12px;
    background-color: var(--bg-secondary-color);

    &.is-readonly {
      grid-template-columns: 32px minmax(0, 1fr) 36px;
      grid-template-areas:
        'title title collapse'
        '. progress .';
      row-gap: 2px;

      .title-container {
        gap: 8px;
      }

      .group-name {
        display: block;
        // Align the first text line with the 36px icon and collapse button.
        padding-block: calc((36px - 1.4em) / 2);
      }

      .group-progress-container {
        padding: 0;
        background: transparent;
      }

      &:not(.has-items) {
        grid-template-areas: 'title title collapse';
      }
    }
  }

  .title-container {
    align-items: flex-start;
    gap: 10px;
  }

  .group-name {
    min-height: 36px;
    font-size: 0.95rem;
  }

  .drag-handle-group,
  .delete-group-btn,
  .collapse-btn {
    width: 36px;
    height: 36px;
  }

  .collapse-btn {
    align-self: start;
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
