<script setup lang="ts">
import type { ChecklistItem, ChecklistPriority } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitEditable } from '~/components/01.kit/kit-editable'

interface Props {
  item: ChecklistItem
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:item', value: ChecklistItem): void
  (e: 'delete'): void
}>()

const isEditingDescription = ref(false)
const isEditingLink = ref(false)
const isPriorityPickerOpen = ref(false)
const priorityPickerMenuRef = ref(null)

const priorityMap: Record<ChecklistPriority, string> = {
  5: 'Высочайший',
  4: 'Высокий',
  3: 'Средний',
  2: 'Низкий',
  1: 'Без приоритета',
}

onClickOutside(priorityPickerMenuRef, () => {
  isPriorityPickerOpen.value = false
})

function updateField<K extends keyof ChecklistItem>(key: K, value: ChecklistItem[K]) {
  emit('update:item', { ...props.item, [key]: value })
}

function setPriority(priority: ChecklistPriority) {
  updateField('priority', priority)
  isPriorityPickerOpen.value = false
}

function handleDescriptionUpdate(value: string) {
  updateField('description', value)
  if (!value)
    isEditingDescription.value = false
}

function handleLinkUpdate(value: string) {
  updateField('link', value)
  if (!value)
    isEditingLink.value = false
}
</script>

<template>
  <div class="checklist-item-wrapper">
    <div class="checklist-item" :class="[`priority-${item.priority}`, { completed: item.completed }]">
      <div class="main-line">
        <button v-if="!readonly" class="drag-handle" title="Перетащить">
          <Icon icon="mdi:drag-vertical" />
        </button>
        <KitCheckbox
          :model-value="item.completed"
          color="accent"
          :readonly="readonly"
          @update:model-value="updateField('completed', !!$event)"
        />
        <KitEditable
          v-if="!readonly"
          :model-value="item.text"
          class="item-text"
          @update:model-value="updateField('text', $event)"
        />
        <div v-else class="item-text">
          {{ item.text }}
        </div>
        <div class="item-actions">
          <button v-if="!readonly" class="action-btn" :class="{ 'is-active': item.link }" title="Добавить/Изменить ссылку" @click="isEditingLink = !isEditingLink">
            <Icon icon="mdi:paperclip" />
          </button>
          <button v-if="!readonly" class="action-btn" :class="{ 'is-active': item.description }" title="Добавить/Изменить заметку" @click="isEditingDescription = !isEditingDescription">
            <Icon icon="mdi:text-box-outline" />
          </button>

          <!-- Priority Picker -->
          <div v-if="!readonly" class="priority-picker-wrapper">
            <button
              class="action-btn priority-btn"
              :class="`is-active-p${item.priority}`"
              title="Изменить приоритет"
              @click="isPriorityPickerOpen = !isPriorityPickerOpen"
            >
              <Icon icon="mdi:flag" />
            </button>
            <div
              v-if="isPriorityPickerOpen"
              ref="priorityPickerMenuRef"
              class="priority-picker-menu"
            >
              <button
                v-for="p in ([5, 4, 3, 2, 1] as const)"
                :key="p"
                class="priority-option"
                :class="`priority-option-${p}`"
                @click="setPriority(p)"
              >
                <div class="priority-indicator" />
                <span class="priority-text">{{ priorityMap[p] }}</span>
                <Icon v-if="item.priority === p" icon="mdi:check" class="check-icon" />
              </button>
            </div>
          </div>

          <button v-if="!readonly" class="delete-item-btn" @click="$emit('delete')">
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>

      <div
        v-if="item.link || isEditingLink || item.description || isEditingDescription"
        class="item-details-container"
      >
        <!-- Блок для ссылки -->
        <div v-if="item.link || isEditingLink" class="detail-block">
          <div class="icon-wrapper">
            <Icon icon="mdi:link-variant" class="detail-icon" />
          </div>
          <KitEditable
            v-if="isEditingLink"
            :model-value="item.link || ''"
            placeholder="https://example.com"
            :readonly="readonly"
            class="details-input"
            @update:model-value="handleLinkUpdate"
          />
          <a v-else :href="item.link" target="_blank" rel="noopener noreferrer" class="detail-link">{{ item.link }}</a>
        </div>

        <!-- Блок для заметки -->
        <div v-if="item.description || isEditingDescription" class="detail-block">
          <div class="icon-wrapper">
            <Icon icon="mdi:text-box-outline" class="detail-icon" width="14" height="14" />
          </div>
          <KitEditable
            v-if="isEditingDescription"
            :model-value="item.description || ''"
            placeholder="Добавить заметку..."
            type="textarea"
            :readonly="readonly"
            class="details-input"
            @update:model-value="handleDescriptionUpdate"
          />
          <div v-else class="detail-text">
            {{ item.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.checklist-item {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary-color);
  border-radius: var(--r-s);
  transition: all 0.2s ease;
  border: 1px solid var(--border-secondary-color);
  padding: 0.375rem 0.5rem;
  gap: 4px;

  // --- Priority Styles ---
  border-left: 3px solid transparent;
  padding-left: calc(0.5rem - 2px);

  &.priority-5 {
    border-left-color: var(--fg-error-color);
  }
  &.priority-4 {
    border-left-color: var(--fg-warning-color);
  }
  &.priority-3 {
    border-left-color: var(--fg-info-color);
  }
  &.priority-2 {
    border-left-color: var(--fg-tertiary-color);
  }
  &.priority-1 {
    border: 1px solid var(--border-secondary-color);
  }

  &:hover {
    background-color: var(--bg-hover-color);
    .delete-item-btn,
    .drag-handle,
    .action-btn {
      opacity: 1;
    }
  }
}

.main-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  margin-left: 6px;
}

.completed {
  .item-text {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
  background-color: var(--bg-secondary-color) !important;
}

.drag-handle,
.delete-item-btn,
.action-btn {
  padding: 0;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  transition: all 0.2s ease;
}

.drag-handle {
  cursor: grab;
  opacity: 0;
  &:active {
    cursor: grabbing;
  }
}

.item-text {
  flex-grow: 1;
  min-width: 0;
  padding: 4px 0;
  line-height: 1.4;
  font-size: 1rem;
}

.item-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 8px;
}

.action-btn {
  opacity: 0.4;
  &:hover {
    color: var(--fg-primary-color);
  }
  &.is-active {
    color: var(--fg-accent-color);
    opacity: 1;
  }
}

.delete-item-btn {
  opacity: 0;
  font-size: 1.2rem;
  &:hover {
    color: var(--fg-error-color);
  }
}

.item-details-container {
  display: flex;
  flex-direction: column;
  margin: 2px 0 4px 6px;
  padding: 2px 0;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
}

.detail-block {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-wrapper {
  flex-shrink: 0;
  height: 20px;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-icon {
  font-size: 1.1rem;
  color: var(--fg-tertiary-color);
}

.details-input {
  width: 100%;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
  background-color: transparent;
  padding: 0;
  border: none;

  &:focus-within {
    color: var(--fg-primary-color);
  }
}

.detail-link {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-accent-color);
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
}

.detail-text {
  width: 100%;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
  white-space: pre-wrap;
  word-break: break-word;
}

// --- Priority Picker Styles ---
.priority-picker-wrapper {
  position: relative;
}

.priority-btn {
  &.is-active-p5 {
    color: var(--fg-error-color);
    opacity: 1;
  }
  &.is-active-p4 {
    color: var(--fg-warning-color);
    opacity: 1;
  }
  &.is-active-p3 {
    color: var(--fg-info-color);
    opacity: 1;
  }
  &.is-active-p2 {
    color: var(--fg-tertiary-color);
    opacity: 1;
  }
}

.priority-picker-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  width: 190px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  box-shadow: var(--shadow-m);
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.priority-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--r-xs);
  text-align: left;
  width: 100%;
  &:hover {
    background-color: var(--bg-hover-color);
  }
  .priority-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  &.priority-option-5 .priority-indicator {
    background-color: var(--fg-error-color);
  }
  &.priority-option-4 .priority-indicator {
    background-color: var(--fg-warning-color);
  }
  &.priority-option-3 .priority-indicator {
    background-color: var(--fg-info-color);
  }
  &.priority-option-2 .priority-indicator {
    background-color: var(--fg-tertiary-color);
  }
  &.priority-option-1 .priority-indicator {
    border: 1px solid var(--fg-tertiary-color);
  }

  .priority-text {
    flex-grow: 1;
    font-size: 0.9rem;
  }
  .check-icon {
    color: var(--fg-accent-color);
    font-size: 1.1rem;
    margin-left: auto;
  }
}
</style>
