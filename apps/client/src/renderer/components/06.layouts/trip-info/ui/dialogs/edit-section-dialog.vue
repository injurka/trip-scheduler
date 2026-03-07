<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { IconPicker } from '~/components/02.shared/icon-picker'
import { useIconPicker } from '../../composables/use-icon-picker'

interface SectionData {
  id: string
  title: string
  icon: string
}

const props = defineProps<{
  visible: boolean
  section: SectionData | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: SectionData): void
}>()

const localTitle = ref('')
const localIcon = ref('mdi:file-document-outline')

const { iconSearchQuery } = useIconPicker()

const canSave = computed(() => localTitle.value.trim().length > 0)

watch(() => props.section, (section) => {
  if (section) {
    localTitle.value = section.title
    localIcon.value = section.icon
    iconSearchQuery.value = ''
  }
}, { immediate: true })

function handleSave() {
  if (!props.section || !canSave.value)
    return
  emit('save', {
    id: props.section.id,
    title: localTitle.value.trim(),
    icon: localIcon.value,
  })
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Редактировать раздел"
    icon="mdi:pencil"
    :max-width="400"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="edit-section-form" @submit.prevent="handleSave">
      <KitInput
        v-model="localTitle"
        label="Название раздела"
        placeholder="Например, 'Билеты' или 'Отели'"
        required
        autofocus
      />

      <div class="icon-picker-block">
        <KitInput
          v-model="iconSearchQuery"
          placeholder="Поиск иконки (напр. 'car')"
          icon="mdi:magnify"
        />
        <div class="icon-picker-field">
          <label class="field-label">Иконка секции</label>
          <IconPicker v-model="localIcon" inline />
        </div>
      </div>

      <KitBtn type="submit" :disabled="!canSave">
        Сохранить
      </KitBtn>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.edit-section-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
}

.icon-picker-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.icon-picker-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}
</style>
