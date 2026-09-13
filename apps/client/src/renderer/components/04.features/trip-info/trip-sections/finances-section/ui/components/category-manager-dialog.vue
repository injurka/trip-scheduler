<script setup lang="ts">
import type { Category } from '../../models/types'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitEditable } from '~/components/01.kit/kit-editable'
import { KitInput } from '~/components/01.kit/kit-input'
import FinancesIconPicker from './finances-icon-picker.vue'

interface Props {
  visible: boolean
  categories: Category[]
}
defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', category: Partial<Category>): void
  (e: 'delete', id: string): void
}>()

const newCategoryName = ref('')
const newCategoryIcon = ref('mdi:tag-outline')

function handleAddCategory() {
  if (!newCategoryName.value.trim())
    return
  emit('save', { name: newCategoryName.value, icon: newCategoryIcon.value })
  newCategoryName.value = ''
  newCategoryIcon.value = 'mdi:tag-outline'
}
</script>

<template>
  <KitDialogWithClose :visible="visible" title="Управление категориями и лимитами" icon="mdi:cog-outline" @update:visible="emit('update:visible', $event)">
    <div class="category-manager">
      <div class="manager-hint">
        Здесь вы можете настроить категории расходов и задать планируемый бюджетный лимит для каждой из них.
      </div>

      <div class="categories-header">
        <span>Категория</span>
        <span class="limit-col-title">План / Лимит</span>
      </div>

      <ul class="categories-list">
        <li v-for="cat in categories" :key="cat.id" class="category-item">
          <FinancesIconPicker
            :model-value="cat.icon"
            @update:model-value="(icon: string) => emit('save', { ...cat, icon })"
          />
          <KitEditable
            :model-value="cat.name"
            class="category-name"
            :readonly="cat.isDefault"
            @update:model-value="emit('save', { ...cat, name: $event })"
          />
          <div class="category-budget-limit" title="Планируемый лимит бюджета">
            <KitInput
              :model-value="cat.budgetLimit ? String(cat.budgetLimit) : ''"
              placeholder="Лимит"
              type="number"
              size="sm"
              @update:model-value="emit('save', { ...cat, budgetLimit: $event ? Number($event) : undefined })"
            />
          </div>
          <button v-if="!cat.isDefault" class="delete-btn" title="Удалить категорию" @click="emit('delete', cat.id)">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </li>
      </ul>

      <form class="add-category-form" @submit.prevent="handleAddCategory">
        <FinancesIconPicker v-model="newCategoryIcon" />
        <KitInput v-model="newCategoryName" placeholder="Новая категория" />
        <KitBtn type="submit" :disabled="!newCategoryName.trim()">
          Добавить
        </KitBtn>
      </form>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.manager-hint {
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  margin-bottom: 0.75rem;
}

.categories-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary-color);
  padding: 0 0.5rem 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 0.5rem;

  .limit-col-title {
    padding-right: 28px;
  }
}

.categories-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 320px;
  overflow-y: auto;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--r-s);
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.category-name {
  flex-grow: 1;
}

.category-budget-limit {
  width: 120px;
  flex-shrink: 0;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--r-s);
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease;

  &:hover {
    color: var(--fg-error-color);
  }
}

.add-category-form {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
