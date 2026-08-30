<script setup lang="ts">
import type { ChecklistTabConfig } from '../models/types'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import ChecklistIconPicker from './checklist-icon-picker.vue'

interface Props {
  visible: boolean
  tab?: ChecklistTabConfig | null
  isNew?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tab: null,
  isNew: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', tab: { id: string, name: string, icon: string }): void
  (e: 'delete', id: string): void
}>()

const tabName = ref('')
const tabIcon = ref('mdi:tag-outline')

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    if (props.tab) {
      tabName.value = props.tab.name
      tabIcon.value = props.tab.icon
    }
    else {
      tabName.value = ''
      tabIcon.value = 'mdi:tag-outline'
    }
  }
})

const isValid = computed(() => !!tabName.value.trim())

function handleSave() {
  if (!isValid.value)
    return

  const id = props.tab ? props.tab.id : `tab_${Date.now()}`
  emit('save', {
    id,
    name: tabName.value.trim(),
    icon: tabIcon.value,
  })
  emit('update:visible', false)
}

function handleDelete() {
  if (props.tab) {
    emit('delete', props.tab.id)
    emit('update:visible', false)
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="isNew ? 'Новая вкладка чек-листа' : 'Редактировать вкладку'"
    :icon="tabIcon"
    :max-width="450"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="tab-dialog-content">
      <div class="form-row">
        <label class="form-label">Иконка вкладки</label>
        <div class="icon-selector-wrapper">
          <ChecklistIconPicker
            :model-value="tabIcon"
            @update:model-value="tabIcon = $event"
          />
          <span class="icon-hint">Нажмите для выбора иконки</span>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label">Название вкладки</label>
        <KitInput
          v-model="tabName"
          placeholder="Например: Must-Try или Шопинг"
          autofocus
          @keyup.enter="handleSave"
        />
      </div>

      <div class="dialog-actions">
        <KitBtn
          v-if="!isNew && tab?.isCustom"
          variant="text"
          color="secondary"
          class="delete-tab-btn"
          @click="handleDelete"
        >
          Удалить
        </KitBtn>
        <div class="right-actions">
          <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
            Отмена
          </KitBtn>
          <KitBtn :disabled="!isValid" icon="mdi:check" @click="handleSave">
            {{ isNew ? 'Создать' : 'Сохранить' }}
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.tab-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 0.5rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}

.icon-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-hint {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.delete-tab-btn:hover {
  color: var(--fg-error-color) !important;
}

.right-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
