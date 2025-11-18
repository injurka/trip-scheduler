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
const isIconPickerOpen = ref(false)
const categoryToPickIconFor = ref<Category | null>(null)

function handleAddCategory() {
  if (!newCategoryName.value.trim())
    return
  emit('save', { name: newCategoryName.value, icon: newCategoryIcon.value })
  newCategoryName.value = ''
  newCategoryIcon.value = 'mdi:tag-outline'
}

function handleIconSelect(icon: string) {
  if (categoryToPickIconFor.value) {
    // Редактирование иконки существующей категории
    emit('save', { ...categoryToPickIconFor.value, icon })
    categoryToPickIconFor.value = null
  }
  else {
    // Выбор иконки для новой категории
    newCategoryIcon.value = icon
  }
}

function openIconPicker(cat: Category | null = null) {
  categoryToPickIconFor.value = cat
  isIconPickerOpen.value = true
}
</script>

<template>
  <KitDialogWithClose :visible="visible" title="Управление категориями" icon="mdi:cog-outline" @update:visible="emit('update:visible', $event)">
    <div class="category-manager">
      <ul class="categories-list">
        <li v-for="cat in categories" :key="cat.id" class="category-item">
          <button class="icon-btn" @click="openIconPicker(cat)">
            <Icon :icon="cat.icon" />
          </button>
          <KitEditable :model-value="cat.name" class="category-name" :readonly="cat.isDefault" @update:model-value="emit('save', { ...cat, name: $event })" />
          <button v-if="!cat.isDefault" class="delete-btn" @click="emit('delete', cat.id)">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </li>
      </ul>
      <form class="add-category-form" @submit.prevent="handleAddCategory">
        <button type="button" class="icon-btn" @click="openIconPicker(null)">
          <Icon :icon="newCategoryIcon" />
        </button>
        <KitInput v-model="newCategoryName" placeholder="Новая категория" />
        <KitBtn type="submit" :disabled="!newCategoryName.trim()">
          Добавить
        </KitBtn>
      </form>
    </div>

    <FinancesIconPicker
      v-model:visible="isIconPickerOpen"
      :current-icon="categoryToPickIconFor ? categoryToPickIconFor.icon : newCategoryIcon"
      @select="handleIconSelect"
    />
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.categories-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 300px;
  overflow-y: auto;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--r-s);
  &:hover {
    background-color: var(--bg-hover-color);
  }
}
.category-name {
  flex-grow: 1;
}
.icon-btn {
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
  padding: 4px;
  border-radius: var(--r-s);
  &:hover {
    background-color: var(--bg-tertiary-color);
  }
}
.delete-btn {
  color: var(--fg-tertiary-color);
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
