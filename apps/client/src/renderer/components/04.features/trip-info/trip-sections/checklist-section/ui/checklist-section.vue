<script setup lang="ts">
import type { ChecklistItem, ChecklistSectionContent, ChecklistTabConfig } from '../models/types'
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useChecklistSection } from '../composables'
import ChecklistGroupComponent from './checklist-group.vue'
import ChecklistItemComponent from './checklist-item.vue'
import ChecklistPresetsModal from './checklist-presets-modal.vue'
import ChecklistTabEditDialog from './checklist-tab-edit-dialog.vue'

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

const {
  items,
  groups,
  activeTab,
  tabItems,
  currentTabConfig,
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
  addTab,
  updateTab,
  deleteTab,
  applyPreset,
} = useChecklistSection(props, emit)

const newUngroupedItemText = ref('')
const newUngroupedItemInputRef = ref<HTMLInputElement | null>(null)
const isPresetsModalOpen = ref(false)
const isTabEditDialogOpen = ref(false)
const isNewTab = ref(false)
const editingTab = ref<ChecklistTabConfig | null>(null)

function onGroupItemsUpdate(groupId: string, updatedGroupItems: ChecklistItem[]) {
  const updatedMap = new Map(updatedGroupItems.map(item => [item.id, item]))
  items.value = items.value.map((item) => {
    if (item.groupId === groupId && updatedMap.has(item.id)) {
      return updatedMap.get(item.id)!
    }
    return item
  })
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

function openNewTabDialog() {
  editingTab.value = null
  isNewTab.value = true
  isTabEditDialogOpen.value = true
}

function openEditTabDialog() {
  editingTab.value = currentTabConfig.value
  isNewTab.value = false
  isTabEditDialogOpen.value = true
}

function handleTabSave(tab: { id: string, name: string, icon: string }) {
  if (isNewTab.value) {
    addTab(tab)
  }
  else {
    updateTab(tab)
  }
}

watch(activeTab, () => {
  newUngroupedItemText.value = ''
})
</script>

<template>
  <div class="checklist-section">
    <!-- Шапка вкладок с кнопками создания/настройки -->
    <div class="tabs-header-wrapper">
      <div class="tabs-control">
        <KitTabs v-model="activeTab" :items="tabItems">
          <template #[activeTab]>
            <div class="tab-content-wrapper">
              <!-- Панель действий -->
              <div v-if="hasItemsInCurrentTab || !props.readonly" class="actions-panel">
                <KitInput
                  v-model="searchQuery"
                  placeholder="Поиск по задачам, ценам, тегам..."
                  icon="mdi:magnify"
                  class="search-input"
                />
                <div class="action-controls">
                  <KitBtn
                    v-if="!readonly"
                    variant="subtle"
                    size="sm"
                    icon="mdi:playlist-star"
                    title="Шаблоны и пресеты"
                    @click="isPresetsModalOpen = true"
                  >
                    <span class="btn-text">Пресеты</span>
                  </KitBtn>

                  <KitBtn
                    :variant="hideCompleted ? 'tonal' : 'subtle'"
                    size="sm"
                    :icon="hideCompleted ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
                    :title="hideCompleted ? 'Показать выполненные задачи' : 'Скрыть выполненные задачи'"
                    @click="hideCompleted = !hideCompleted"
                  >
                    <span class="btn-text">{{ hideCompleted ? 'Скрыты' : 'Скрыть готовые' }}</span>
                  </KitBtn>

                  <KitBtn
                    v-if="!readonly"
                    variant="tonal"
                    size="sm"
                    icon="mdi:playlist-plus"
                    title="Добавить группу задач"
                    @click="addGroup(activeTab)"
                  >
                    <span class="btn-text">Добавить группу</span>
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

              <!-- Содержимое: группы и задачи (отображается только если есть контент) -->
              <div v-if="currentTabGroups.length > 0 || currentTabUngroupedItems.length > 0" class="checklist-content">
                <draggable
                  v-if="!readonly && currentTabGroups.length > 0"
                  :model-value="currentTabGroups"
                  item-key="id"
                  handle=".drag-handle-group"
                  ghost-class="ghost-item"
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
                      @add-item="text => addItem(text, activeTab, group.id)"
                    />
                  </template>
                </draggable>
                <div v-else-if="currentTabGroups.length > 0" class="groups-list">
                  <ChecklistGroupComponent
                    v-for="group in currentTabGroups"
                    :key="group.id"
                    :group="group"
                    :items="itemsByGroupId[group.id] || []"
                    :readonly="readonly"
                    @update:group="updateGroup"
                    @update:items="onGroupItemsUpdate(group.id, $event)"
                    @delete="deleteGroup(group.id)"
                    @add-item="text => addItem(text, activeTab, group.id)"
                  />
                </div>

                <!-- Задачи без группы -->
                <div v-if="currentTabUngroupedItems.length > 0 || (!readonly && currentTabGroups.length > 0)">
                  <KitDivider v-if="currentTabGroups.length > 0" class="group-divider">
                    Прочие задачи
                  </KitDivider>
                  <div class="ungrouped-wrapper">
                    <draggable
                      v-if="!readonly"
                      :model-value="currentTabUngroupedItems"
                      item-key="id"
                      handle=".drag-handle"
                      ghost-class="ghost-item"
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
                    <div v-else class="ungrouped-items-list">
                      <ChecklistItemComponent
                        v-for="item in currentTabUngroupedItems"
                        :key="item.id"
                        :item="item"
                        :readonly="readonly"
                        @update:item="updateItem"
                        @delete="deleteItem(item.id)"
                      />
                    </div>
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

              <!-- Состояние отсутствия задач -->
              <div v-else class="empty-state">
                <Icon icon="mdi:clipboard-check-outline" class="empty-icon" />
                <p v-if="searchQuery">
                  По вашему запросу ничего не найдено.
                </p>
                <p v-else-if="hideCompleted && (items.filter(i => i.type === activeTab)).length > 0">
                  Все задачи выполнены!
                </p>
                <p v-else>
                  В этой вкладке пока нет задач.
                </p>
                <div v-if="!readonly && !searchQuery" class="empty-state-actions">
                  <KitBtn variant="tonal" icon="mdi:playlist-star" @click="isPresetsModalOpen = true">
                    Выбрать готовый набор
                  </KitBtn>
                  <KitBtn variant="tonal" icon="mdi:playlist-plus" @click="addGroup(activeTab)">
                    Добавить группу
                  </KitBtn>
                </div>
              </div>
            </div>
          </template>
        </KitTabs>
      </div>

      <!-- Кнопки управления вкладками -->
      <div v-if="!readonly" class="tab-management-actions">
        <KitTooltip text="Добавить новую вкладку">
          <button class="tab-action-btn" @click="openNewTabDialog">
            <Icon icon="mdi:tab-plus" />
          </button>
        </KitTooltip>
        <KitTooltip v-if="currentTabConfig?.isCustom" text="Настроить активную вкладку">
          <button class="tab-action-btn" @click="openEditTabDialog">
            <Icon icon="mdi:dots-vertical" />
          </button>
        </KitTooltip>
      </div>
    </div>

    <!-- Модальные окна -->
    <ChecklistPresetsModal
      v-model:visible="isPresetsModalOpen"
      :current-tab="activeTab"
      @select="applyPreset"
    />

    <ChecklistTabEditDialog
      v-model:visible="isTabEditDialogOpen"
      :tab="editingTab"
      :is-new="isNewTab"
      @save="handleTabSave"
      @delete="deleteTab"
    />
  </div>
</template>

<style scoped lang="scss">
.checklist-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 6;
}

.tabs-header-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.tabs-control {
  flex-grow: 1;
  min-width: 0;
}

.tab-management-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  right: 6px;
  top: 6px;
  z-index: 10;
}

.tab-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }
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
  flex-wrap: nowrap;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
}

.search-input {
  flex: 1 1 auto;
  min-width: 0;
}

.action-controls {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.375rem;
  align-items: center;
  flex-shrink: 0;
}

@include media-down(sm) {
  .actions-panel {
    gap: 0.375rem;
  }

  .action-controls {
    gap: 0.25rem;

    .btn-text {
      display: none;
    }

    :deep(.kit-btn) {
      padding: 0.375rem !important;
      min-width: 36px !important;
      height: 36px !important;
      justify-content: center !important;

      .kit-btn-content {
        gap: 0 !important;
      }
    }
  }
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar-container {
  flex-grow: 1;
  height: 14px;
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
  margin-bottom: 1.5rem;
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
  padding: 2.5rem 1rem;
  margin-top: 1rem;
  text-align: center;
  color: var(--fg-tertiary-color);
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 2px dashed var(--border-secondary-color);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.empty-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}
</style>
