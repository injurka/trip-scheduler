<script setup lang="ts">
import type { ChecklistPreset, ChecklistTab } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { HARDCODED_PRESETS } from '../constant'

interface Props {
  visible: boolean
  currentTab: ChecklistTab
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', preset: ChecklistPreset): void
}>()

const expandedPresetId = ref<string | null>(null)

// Фильтруем пресеты в зависимости от активной вкладки
const filteredPresets = computed(() => {
  return HARDCODED_PRESETS.filter(preset => preset.tab === props.currentTab)
})

function togglePreview(id: string) {
  if (expandedPresetId.value === id)
    expandedPresetId.value = null
  else
    expandedPresetId.value = id
}

function selectPreset(preset: ChecklistPreset) {
  emit('select', preset)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="currentTab === 'preparation' ? 'Наборы для сборов' : 'Шаблоны для поездки'"
    :icon="currentTab === 'preparation' ? 'mdi:bag-suitcase' : 'mdi:clipboard-list-outline'"
    :max-width="600"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="presets-container">
      <div v-if="filteredPresets.length === 0" class="no-presets">
        Для этой вкладки пока нет готовых наборов.
      </div>

      <div
        v-for="preset in filteredPresets"
        :key="preset.id"
        class="preset-card"
        :class="{ 'is-expanded': expandedPresetId === preset.id }"
      >
        <div class="preset-main-content">
          <div class="preset-header">
            <div class="preset-icon-wrapper">
              <Icon :icon="preset.icon" class="preset-icon" />
            </div>
            <div class="preset-info">
              <h3 class="preset-title">
                {{ preset.name }}
              </h3>
              <p class="preset-description">
                {{ preset.description }}
              </p>
            </div>
          </div>

          <div class="preset-footer">
            <div class="preset-meta">
              <span class="meta-tag" title="Количество групп">
                <Icon icon="mdi:folder-multiple-outline" />
                {{ preset.groups.length }}
              </span>
              <span class="meta-tag" title="Количество задач">
                <Icon icon="mdi:checkbox-marked-circle-outline" />
                {{ preset.groups.reduce((acc, g) => acc + g.items.length, 0) }}
              </span>
            </div>

            <div class="preset-actions">
              <KitBtn
                variant="text"
                size="sm"
                :icon="expandedPresetId === preset.id ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                @click="togglePreview(preset.id)"
              >
                {{ expandedPresetId === preset.id ? 'Скрыть' : 'Состав' }}
              </KitBtn>
              <KitBtn
                variant="tonal"
                size="sm"
                icon="mdi:plus"
                color="primary"
                @click="selectPreset(preset)"
              >
                Добавить
              </KitBtn>
            </div>
          </div>
        </div>

        <!-- Секция предпросмотра -->
        <div v-if="expandedPresetId === preset.id" class="preset-preview">
          <div v-for="(group, idx) in preset.groups" :key="idx" class="preview-group">
            <div class="preview-group-header">
              <Icon :icon="group.icon" class="preview-group-icon" />
              <span class="preview-group-name">{{ group.name }}</span>
            </div>
            <ul class="preview-items-list">
              <li v-for="(item, iIdx) in group.items" :key="iIdx" class="preview-item">
                <div class="preview-dot" :class="`priority-${item.priority || 1}`" />
                <span class="preview-item-text">{{ item.text }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.presets-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.no-presets {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 24px;
  background: var(--bg-secondary-color);
  border-radius: var(--r-m);
}

.preset-card {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
  transition: all 0.2s ease;

  &.is-expanded {
    border-color: var(--border-primary-color);
    background-color: var(--bg-primary-color);
  }
}

.preset-main-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.preset-icon-wrapper {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  flex-shrink: 0;
}

.preset-icon {
  font-size: 24px;
  color: var(--fg-accent-color);
}

.preset-info {
  flex-grow: 1;
  min-width: 0;
}

.preset-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.preset-description {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.4;
}

.preset-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
}

.preset-meta {
  display: flex;
  gap: 8px;
}

.meta-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  background: var(--bg-tertiary-color);
  padding: 4px 8px;
  border-radius: var(--r-s);
}

.preset-actions {
  display: flex;
  gap: 8px;
}

/* Мобильная адаптация */
@media (max-width: 500px) {
  .preset-header {
    gap: 12px;
  }
  .preset-icon-wrapper {
    width: 40px;
    height: 40px;
  }
  .preset-icon {
    font-size: 20px;
  }
  .preset-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .preset-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

/* Стили предпросмотра */
.preset-preview {
  background-color: var(--bg-tertiary-color);
  border-top: 1px solid var(--border-secondary-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 300px;
  overflow-y: auto;

  /* Кастомный скроллбар */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 3px;
  }
}

.preview-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-primary-color);
  font-weight: 600;
  font-size: 0.95rem;
}

.preview-group-icon {
  color: var(--fg-secondary-color);
}

.preview-items-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
}

.preview-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.priority-5 {
    background-color: var(--fg-error-color);
  }
  &.priority-4 {
    background-color: var(--fg-warning-color);
  }
  &.priority-3 {
    background-color: var(--fg-info-color);
  }
  &.priority-2 {
    background-color: var(--fg-tertiary-color);
  }
  &.priority-1 {
    border: 1px solid var(--fg-tertiary-color);
  }
}
</style>
