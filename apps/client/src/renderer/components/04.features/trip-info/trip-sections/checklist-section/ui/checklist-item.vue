<script setup lang="ts">
import type { ChecklistItem, ChecklistPriority, ChecklistSubtask } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitEditable } from '~/components/01.kit/kit-editable'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'

interface Props {
  item: ChecklistItem
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:item', value: ChecklistItem): void
  (e: 'delete'): void
}>()

const { canEdit } = useTripPermissions()
const canCheck = computed(() => canEdit.value)

const isEditingDescription = ref(false)
const isEditingLink = ref(false)
const isEditingCost = ref(false)
const isEditingLocation = ref(false)
const isPriorityPickerOpen = ref(false)
const isSubtasksExpanded = ref(true)
const newSubtaskText = ref('')
const isAddingSubtask = ref(false)

const priorityPickerMenuRef = ref(null)

const priorityMap: Record<ChecklistPriority, string> = {
  5: 'Критический',
  4: 'Высокий',
  3: 'Средний',
  2: 'Низкий',
  1: 'Без приоритета',
}

onClickOutside(priorityPickerMenuRef, () => {
  isPriorityPickerOpen.value = false
})

function updateField<K extends keyof ChecklistItem>(key: K, value: ChecklistItem[K]) {
  if (key !== 'completed' && props.readonly)
    return
  if (key === 'completed' && !canCheck.value)
    return
  emit('update:item', { ...props.item, [key]: value })
}

function setPriority(priority: ChecklistPriority) {
  if (props.readonly)
    return
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

function handleCostUpdate(value: string) {
  updateField('cost', value)
  if (!value)
    isEditingCost.value = false
}

function handleLocationUpdate(value: string) {
  updateField('location', value)
  if (!value)
    isEditingLocation.value = false
}

// Subtasks
const subtasks = computed(() => props.item.subtasks || [])
const subtasksStats = computed(() => {
  const total = subtasks.value.length
  if (total === 0)
    return null
  const completed = subtasks.value.filter(s => s.completed).length
  return { completed, total, allDone: completed === total }
})

function handleToggleSubtask(subtaskId: string) {
  if (!canCheck.value)
    return
  const updated = subtasks.value.map((s) => {
    if (s.id === subtaskId)
      return { ...s, completed: !s.completed }
    return s
  })
  updateField('subtasks', updated)
}

function handleAddSubtask() {
  if (props.readonly || !newSubtaskText.value.trim())
    return
  const newSubtask: ChecklistSubtask = {
    id: uuidv4(),
    text: newSubtaskText.value.trim(),
    completed: false,
  }
  updateField('subtasks', [...subtasks.value, newSubtask])
  newSubtaskText.value = ''
  isSubtasksExpanded.value = true
}

function handleDeleteSubtask(subtaskId: string) {
  if (props.readonly)
    return
  const updated = subtasks.value.filter(s => s.id !== subtaskId)
  updateField('subtasks', updated)
}

function handleUpdateSubtaskText(subtaskId: string, text: string) {
  if (props.readonly)
    return
  const updated = subtasks.value.map((s) => {
    if (s.id === subtaskId)
      return { ...s, text }
    return s
  })
  updateField('subtasks', updated)
}

// Pre-compiled regexes for maximum markdown rendering performance
const BOLD_REGEX = /\*\*(.*?)\*\*/g
const ITALIC_REGEX = /\*(.*?)\*/g
const CODE_REGEX = /`([^`]+)`/g
const LINK_REGEX = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g

function renderMarkdown(text?: string | null): string {
  if (!text)
    return ''

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(BOLD_REGEX, '<strong>$1</strong>')
    .replace(ITALIC_REGEX, '<em>$1</em>')
    .replace(CODE_REGEX, '<code>$1</code>')
    .replace(LINK_REGEX, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>')
}

const renderedText = computed(() => renderMarkdown(props.item.text))
const renderedDescription = computed(() => renderMarkdown(props.item.description))
</script>

<template>
  <div class="checklist-item-wrapper">
    <div
      class="checklist-item"
      :class="[
        `priority-${item.priority}`,
        { 'completed': item.completed, 'has-subtasks': subtasks.length > 0 },
      ]"
    >
      <div class="main-line">
        <button v-if="!readonly" class="drag-handle" title="Перетащить">
          <Icon icon="mdi:drag-vertical" />
        </button>

        <KitCheckbox
          :model-value="item.completed"
          color="accent"
          :readonly="!canCheck"
          @update:model-value="updateField('completed', !!$event)"
        />

        <div class="text-and-badges">
          <KitEditable
            v-if="!readonly"
            :model-value="item.text"
            class="item-text"
            @update:model-value="updateField('text', $event)"
          />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else class="item-text-view" v-html="renderedText" />

          <!-- Мета-бейджи (Цена, Локация, Подзадачи) -->
          <div class="meta-badges">
            <span v-if="item.cost" class="badge badge-cost" title="Ориентировочная стоимость">
              <Icon icon="mdi:currency-usd" class="badge-icon" />
              {{ item.cost }}
            </span>
            <span v-if="item.location" class="badge badge-location" title="Локация">
              <Icon icon="mdi:map-marker-outline" class="badge-icon" />
              {{ item.location }}
            </span>
            <a
              v-if="item.link && readonly"
              :href="item.link"
              target="_blank"
              rel="noopener noreferrer"
              class="badge badge-link"
              title="Открыть ссылку"
            >
              <Icon icon="mdi:link-variant" class="badge-icon" />
              Ссылка
            </a>
            <button
              v-if="subtasksStats"
              class="badge badge-subtasks"
              :class="{ 'all-done': subtasksStats.allDone }"
              title="Развернуть/свернуть подзадачи"
              @click="isSubtasksExpanded = !isSubtasksExpanded"
            >
              <Icon icon="mdi:format-list-checks" class="badge-icon" />
              {{ subtasksStats.completed }}/{{ subtasksStats.total }}
            </button>
          </div>
        </div>

        <div v-if="!readonly" class="item-actions">
          <button
            class="action-btn"
            :class="{ 'is-active': subtasks.length > 0 || isAddingSubtask }"
            title="Подпункты (Sub-tasks)"
            @click="isAddingSubtask = !isAddingSubtask; isSubtasksExpanded = true"
          >
            <Icon icon="mdi:format-list-bulleted" />
          </button>

          <button
            class="action-btn"
            :class="{ 'is-active': item.cost || isEditingCost }"
            title="Стоимость"
            @click="isEditingCost = !isEditingCost"
          >
            <Icon icon="mdi:cash-multiple" />
          </button>

          <button
            class="action-btn"
            :class="{ 'is-active': item.location || isEditingLocation }"
            title="Локация"
            @click="isEditingLocation = !isEditingLocation"
          >
            <Icon icon="mdi:map-marker-plus-outline" />
          </button>

          <button
            class="action-btn"
            :class="{ 'is-active': item.link || isEditingLink }"
            title="Ссылка"
            @click="isEditingLink = !isEditingLink"
          >
            <Icon icon="mdi:link-variant" />
          </button>

          <button
            class="action-btn"
            :class="{ 'is-active': item.description || isEditingDescription }"
            title="Заметка / Гайд"
            @click="isEditingDescription = !isEditingDescription"
          >
            <Icon icon="mdi:text-box-outline" />
          </button>

          <div class="priority-picker-wrapper">
            <button
              class="action-btn priority-btn"
              :class="`is-active-p${item.priority}`"
              title="Приоритет"
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

          <button class="delete-item-btn" title="Удалить задачу" @click="$emit('delete')">
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>

      <!-- Детали: Стоимость, Локация, Ссылка, Описание -->
      <div
        v-if="item.cost || isEditingCost || item.location || isEditingLocation || item.link || isEditingLink || item.description || isEditingDescription"
        class="item-details-container"
      >
        <!-- Стоимость -->
        <div v-if="isEditingCost" class="detail-block">
          <div class="icon-wrapper">
            <Icon icon="mdi:cash" class="detail-icon text-accent" />
          </div>
          <KitEditable
            :model-value="item.cost || ''"
            placeholder="Стоимость, например: ~65 TWD / ~180 ₽"
            :readonly="readonly"
            class="details-input"
            @update:model-value="handleCostUpdate"
          />
        </div>

        <!-- Локация -->
        <div v-if="isEditingLocation" class="detail-block">
          <div class="icon-wrapper">
            <Icon icon="mdi:map-marker" class="detail-icon text-accent" />
          </div>
          <KitEditable
            :model-value="item.location || ''"
            placeholder="Локация или где искать/пробовать..."
            :readonly="readonly"
            class="details-input"
            @update:model-value="handleLocationUpdate"
          />
        </div>

        <!-- Ссылка -->
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

        <!-- Описание / Гайд -->
        <div v-if="item.description || isEditingDescription" class="detail-block">
          <div class="icon-wrapper">
            <Icon icon="mdi:text-box-outline" class="detail-icon" width="14" height="14" />
          </div>
          <KitEditable
            v-if="isEditingDescription"
            :model-value="item.description || ''"
            placeholder="Добавить совет, лайфхак или детали..."
            type="textarea"
            :readonly="readonly"
            class="details-input"
            @update:model-value="handleDescriptionUpdate"
          />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else class="detail-text" v-html="renderedDescription" />
        </div>
      </div>

      <!-- Блок вложенных подзадач (Sub-tasks) -->
      <div v-if="(subtasks.length > 0 || isAddingSubtask) && isSubtasksExpanded" class="subtasks-container">
        <div v-for="sub in subtasks" :key="sub.id" class="subtask-row" :class="{ completed: sub.completed }">
          <KitCheckbox
            :model-value="sub.completed"
            color="accent"
            :readonly="!canCheck"
            @update:model-value="handleToggleSubtask(sub.id)"
          />
          <KitEditable
            v-if="!readonly"
            :model-value="sub.text"
            class="subtask-text"
            @update:model-value="handleUpdateSubtaskText(sub.id, $event)"
          />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else class="subtask-text-view" v-html="renderMarkdown(sub.text)" />
          <button v-if="!readonly" class="delete-subtask-btn" title="Удалить подпункт" @click="handleDeleteSubtask(sub.id)">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <form v-if="!readonly && isAddingSubtask" class="add-subtask-form" @submit.prevent="handleAddSubtask">
          <input
            v-model="newSubtaskText"
            type="text"
            placeholder="Добавить подпункт..."
            class="add-subtask-input"
            autofocus
          >
          <button type="submit" class="add-subtask-submit-btn" :disabled="!newSubtaskText.trim()">
            <Icon icon="mdi:plus" />
          </button>
        </form>
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
  padding: 0.4rem 0.5rem;
  gap: 4px;

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
  margin-left: 4px;
}

.completed {
  .item-text,
  .item-text-view {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
  background-color: var(--bg-secondary-color) !important;
}

.text-and-badges {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
  gap: 2px;
}

.item-text,
.item-text-view {
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--fg-primary-color);

  :deep(strong) {
    font-weight: 600;
    color: var(--fg-primary-color);
  }
  :deep(code) {
    background: var(--bg-tertiary-color);
    padding: 1px 4px;
    border-radius: var(--r-xs);
    font-size: 0.85em;
  }
}

.meta-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  white-space: nowrap;

  .badge-icon {
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  &.badge-cost {
    background: rgba(var(--fg-accent-color-rgb, 16, 185, 129), 0.1);
    color: var(--fg-accent-color);
    border-color: rgba(var(--fg-accent-color-rgb, 16, 185, 129), 0.2);
  }

  &.badge-location {
    color: var(--fg-info-color);
    white-space: normal;
    word-break: break-word;
    max-width: 100%;
    line-height: 1.3;
    padding-top: 2px;
    padding-bottom: 2px;

    .badge-icon {
      align-self: flex-start;
      margin-top: 1px;
    }
  }

  &.badge-link {
    text-decoration: none;
    color: var(--fg-accent-color);
    &:hover {
      text-decoration: underline;
    }
  }

  &.badge-subtasks {
    cursor: pointer;
    border: none;
    background: var(--bg-secondary-color);
    transition: all 0.15s;

    &:hover {
      background: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }

    &.all-done {
      color: var(--fg-success-color);
      background: rgba(var(--fg-success-color-rgb, 34, 197, 94), 0.1);
    }
  }
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

.item-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 8px;
}

.action-btn {
  opacity: 0.35;
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
  font-size: 1.1rem;
  &:hover {
    color: var(--fg-error-color);
  }
}

.item-details-container {
  display: flex;
  flex-direction: column;
  margin: 4px 0 2px 28px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-secondary-color);
  gap: 4px;
}

.detail-block {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-wrapper {
  flex-shrink: 0;
  height: 18px;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-icon {
  font-size: 1rem;
  color: var(--fg-tertiary-color);
}

.details-input {
  width: 100%;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--fg-secondary-color);
  background-color: transparent;
  padding: 0;
  border: none;

  &:focus-within {
    color: var(--fg-primary-color);
  }
}

.detail-link {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--fg-accent-color);
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
}

.detail-text {
  width: 100%;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
  word-break: break-word;

  :deep(strong) {
    color: var(--fg-primary-color);
    font-weight: 600;
  }

  :deep(em) {
    color: var(--fg-accent-color);
    font-style: normal;
    font-weight: 600;
  }

  :deep(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    color: var(--fg-accent-color);
    background: var(--bg-tertiary-color);
    padding: 1px 5px;
    border-radius: var(--r-xs, 4px);
    border: 1px solid var(--border-secondary-color);
  }

  :deep(a) {
    color: var(--fg-accent-color);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}

/* Subtasks */
.subtasks-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0 2px 28px;
  padding-left: 8px;
  border-left: 2px solid var(--border-secondary-color);
}

.subtask-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;

  &.completed {
    .subtask-text,
    .subtask-text-view {
      text-decoration: line-through;
      color: var(--fg-tertiary-color);
    }
  }

  &:hover .delete-subtask-btn {
    opacity: 1;
  }
}

.subtask-text,
.subtask-text-view {
  flex-grow: 1;
  font-size: 0.85rem;
  color: var(--fg-primary-color);
}

.delete-subtask-btn {
  background: none;
  border: none;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary-color);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover {
    color: var(--fg-error-color);
  }
}

.add-subtask-form {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.add-subtask-input {
  flex-grow: 1;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  padding: 2px 6px;
  font-size: 0.8rem;
  color: var(--fg-primary-color);

  &:focus {
    outline: none;
    border-color: var(--fg-accent-color);
  }
}

.add-subtask-submit-btn {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  color: var(--fg-accent-color);
  cursor: pointer;
  border-radius: var(--r-xs);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

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
  border: none;
  background: transparent;
  cursor: pointer;

  &:hover {
    background-color: var(--bg-hover-color);
  }
  .priority-indicator {
    width: 10px;
    height: 10px;
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
    font-size: 0.85rem;
  }
  .check-icon {
    color: var(--fg-accent-color);
    font-size: 1.1rem;
    margin-left: auto;
  }
}
</style>
