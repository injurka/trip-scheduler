<script setup lang="ts">
import type { ChecklistItem, ChecklistSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useChecklistSection } from '../composables'
import ChecklistGroupComponent from './checklist-group.vue'
import ChecklistItemComponent from './checklist-item.vue'

// --- Типы ---
interface Props {
  section: {
    id: string
    type: 'checklist'
    content: ChecklistSectionContent
  }
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'updateSection', value: { id: string, type: 'checklist', content: ChecklistSectionContent }): void
}>()

// --- Логика из хука ---
const {
  items,
  groups,
  activeTab,
  tabItems,
  progress,
  hideCompleted,
  searchQuery,
  currentTabGroups,
  currentTabUngroupedItems,
  itemsByGroupId,
  hasItemsInCurrentTab,
  addItem,
  updateItem,
  deleteItem,
  addGroup,
  deleteGroup,
  updateGroup,
} = useChecklistSection(props, emit)

const newUngroupedItemText = ref('')
const newUngroupedItemInputRef = ref<HTMLInputElement | null>(null)

function onGroupItemsUpdate(groupId: string, updatedItems: ChecklistItem[]) {
  const otherItems = items.value.filter(i => i.groupId !== groupId)
  const groupItems = items.value
    .filter(i => i.groupId === groupId)
    .map(originalItem => updatedItems.find(u => u.id === originalItem.id) || originalItem)

  items.value = [...otherItems, ...groupItems]
}

function onUngroupedItemsUpdate(newUngroupedItems: ChecklistItem[]) {
  const otherItems = items.value.filter(i => i.groupId || i.type !== activeTab.value)
  items.value = [...newUngroupedItems, ...otherItems]
}

function onAddUngroupedItem() {
  if (newUngroupedItemText.value.trim()) {
    addItem(newUngroupedItemText.value, activeTab.value)
    newUngroupedItemText.value = ''
    newUngroupedItemInputRef.value?.focus()
  }
}

watch(activeTab, () => {
  newUngroupedItemText.value = ''
})
</script>

<template>
  <div class="checklist-section">
    <KitTabs v-model="activeTab" :items="tabItems">
      <template #preparation>
        <div class="tab-content-wrapper">
          <!-- Панель действий с новыми элементами -->
          <div v-if="hasItemsInCurrentTab || !props.readonly" class="actions-panel">
            <KitInput v-model="searchQuery" placeholder="Поиск по задачам..." icon="mdi:magnify" class="search-input" />
            <div class="action-controls">
              <KitCheckbox v-model="hideCompleted">
                Скрыть выполненные
              </KitCheckbox>
              <KitBtn v-if="!readonly" icon="mdi:playlist-plus" @click="addGroup('preparation')">
                Добавить группу
              </KitBtn>
            </div>
          </div>

          <!-- Прогресс-бар -->
          <div v-if="hasItemsInCurrentTab || !props.readonly" class="progress-container">
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: `${progress}%` }" />
            </div>
            <span class="progress-text">{{ progress }}%</span>
          </div>

          <!-- Контент -->
          <div class="checklist-content">
            <!-- Группы -->
            <draggable
              :model-value="currentTabGroups"
              item-key="id"
              handle=".drag-handle-group"
              ghost-class="ghost-item"
              :disabled="readonly"
              class="groups-list"
              @update:model-value="groups = $event"
            >
              <template #item="{ element: group }">
                <ChecklistGroupComponent
                  :group="group"
                  :items="itemsByGroupId[group.id] || []"
                  :readonly="readonly"
                  @update:group="updateGroup"
                  @update:items="onGroupItemsUpdate(group.id, $event)"
                  @delete="deleteGroup(group.id)"
                  @add-item="text => addItem(text, 'preparation', group.id)"
                />
              </template>
            </draggable>

            <!-- Задачи без группы -->
            <div v-if="currentTabUngroupedItems.length > 0 || !readonly">
              <KitDivider v-if="currentTabGroups.length > 0" class="group-divider">
                Прочие задачи
              </KitDivider>
              <div class="ungrouped-wrapper">
                <draggable
                  :model-value="currentTabUngroupedItems"
                  item-key="id"
                  handle=".drag-handle"
                  ghost-class="ghost-item"
                  :disabled="readonly"
                  class="ungrouped-items-list"
                  @update:model-value="onUngroupedItemsUpdate"
                >
                  <template #item="{ element: item }">
                    <ChecklistItemComponent
                      :item="item"
                      :readonly="readonly"
                      @update:item="updateItem"
                      @delete="deleteItem(item.id)"
                    />
                  </template>
                </draggable>
                <form
                  v-if="!readonly"
                  class="add-item-form"
                  :class="{ 'has-items': currentTabUngroupedItems.length > 0 }"
                  @submit.prevent="onAddUngroupedItem"
                >
                  <input
                    ref="newUngroupedItemInputRef"
                    v-model="newUngroupedItemText"
                    type="text"
                    placeholder="Добавить прочую задачу..."
                    class="add-item-input"
                  >
                  <KitBtn type="submit" size="sm" :disabled="!newUngroupedItemText.trim()">
                    Добавить
                  </KitBtn>
                </form>
              </div>
            </div>
          </div>

          <!-- Пустое состояние (если после всех фильтров ничего не осталось) -->
          <div v-if="currentTabGroups.length === 0 && currentTabUngroupedItems.length === 0" class="empty-state">
            <Icon icon="mdi:clipboard-check-outline" class="empty-icon" />
            <p v-if="searchQuery">
              По вашему запросу ничего не найдено.
            </p>
            <p v-else-if="hideCompleted && (items.filter(i => i.type === activeTab)).length > 0">
              Все задачи выполнены!
            </p>
            <p v-else>
              Задач пока нет.
            </p>
          </div>
        </div>
      </template>
      <template #in-trip>
        <div class="tab-content-wrapper">
          <div v-if="hasItemsInCurrentTab || !props.readonly" class="actions-panel">
            <KitInput v-model="searchQuery" placeholder="Поиск по задачам..." icon="mdi:magnify" class="search-input" />
            <div class="action-controls">
              <KitCheckbox v-model="hideCompleted">
                Скрыть выполненные
              </KitCheckbox>
              <KitBtn v-if="!readonly" icon="mdi:playlist-plus" @click="addGroup('in-trip')">
                Добавить группу
              </KitBtn>
            </div>
          </div>
          <div v-if="hasItemsInCurrentTab || !props.readonly" class="progress-container">
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: `${progress}%` }" />
            </div>
            <span class="progress-text">{{ progress }}%</span>
          </div>
          <div class="checklist-content">
            <draggable
              :model-value="currentTabGroups"
              item-key="id"
              handle=".drag-handle-group"
              ghost-class="ghost-item"
              :disabled="readonly"
              class="groups-list"
              @update:model-value="groups = $event"
            >
              <template #item="{ element: group }">
                <ChecklistGroupComponent
                  :group="group"
                  :items="itemsByGroupId[group.id] || []"
                  :readonly="readonly"
                  @update:group="updateGroup"
                  @update:items="onGroupItemsUpdate(group.id, $event)"
                  @delete="deleteGroup(group.id)"
                  @add-item="text => addItem(text, 'in-trip', group.id)"
                />
              </template>
            </draggable>
            <div v-if="currentTabUngroupedItems.length > 0 || !readonly">
              <KitDivider v-if="currentTabGroups.length > 0" class="group-divider">
                Прочие задачи
              </KitDivider>
              <div class="ungrouped-wrapper">
                <draggable
                  :model-value="currentTabUngroupedItems"
                  item-key="id"
                  handle=".drag-handle"
                  ghost-class="ghost-item"
                  :disabled="readonly"
                  class="ungrouped-items-list"
                  @update:model-value="onUngroupedItemsUpdate"
                >
                  <template #item="{ element: item }">
                    <ChecklistItemComponent
                      :item="item"
                      :readonly="readonly"
                      @update:item="updateItem"
                      @delete="deleteItem(item.id)"
                    />
                  </template>
                </draggable>
                <form
                  v-if="!readonly"
                  class="add-item-form"
                  :class="{ 'has-items': currentTabUngroupedItems.length > 0 }"
                  @submit.prevent="onAddUngroupedItem"
                >
                  <input
                    ref="newUngroupedItemInputRef"
                    v-model="newUngroupedItemText"
                    type="text"
                    placeholder="Добавить прочую задачу..."
                    class="add-item-input"
                  >
                  <KitBtn type="submit" size="sm" :disabled="!newUngroupedItemText.trim()">
                    Добавить
                  </KitBtn>
                </form>
              </div>
            </div>
          </div>
          <div v-if="currentTabGroups.length === 0 && currentTabUngroupedItems.length === 0" class="empty-state">
            <Icon icon="mdi:clipboard-check-outline" class="empty-icon" />
            <p v-if="searchQuery">
              По вашему запросу ничего не найдено.
            </p>
            <p v-else-if="hideCompleted && (items.filter(i => i.type === activeTab)).length > 0">
              Все задачи выполнены!
            </p>
            <p v-else>
              Задач пока нет.
            </p>
          </div>
        </div>
      </template>
    </KitTabs>
  </div>
</template>

<style scoped lang="scss">
.checklist-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 4px;
}

.group-divider {
  margin: 16px 0 8px;
}

.actions-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.search-input {
  flex: 1 1 250px;
}

.action-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  flex: 1 1 auto;
  justify-content: flex-end;
}

/* Адаптивность для мобильных */
@media (max-width: 768px) {
  .actions-panel {
    flex-direction: column;
    align-items: stretch;
  }
  .action-controls {
    justify-content: space-between;
  }
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar-container {
  flex-grow: 1;
  height: 16px;
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

.progress-text {
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 600;
}

.checklist-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 96px;
}

.groups-list,
.ungrouped-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ungrouped-wrapper {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  padding: 0.5rem;
  border: 1px solid var(--border-secondary-color);
}

.add-item-form {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem;

  &.has-items {
    border-top: 1px solid var(--border-secondary-color);
    margin-top: 8px;
    padding-top: 8px;
  }
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
  }
}

.ghost-item {
  opacity: 0.5;
  background: var(--bg-accent-overlay-color);
  border-radius: var(--r-m);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  margin-top: 1rem;
  text-align: center;
  color: var(--fg-tertiary-color);
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 2px dashed var(--border-secondary-color);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}
</style>
