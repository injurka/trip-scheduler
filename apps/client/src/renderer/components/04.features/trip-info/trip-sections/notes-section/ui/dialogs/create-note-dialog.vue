<script setup lang="ts">
import type { NoteType } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'

const props = defineProps<{
  visible: boolean
  type: NoteType
  parentId: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'create': [title: string]
}>()

const vFocus = {
  mounted: (el: HTMLElement) => el.focus(),
}

const title = ref('')

watch(() => props.visible, (v) => {
  if (v)
    title.value = ''
})

const dialogTitle = computed(() => {
  if (props.type === 'folder')
    return 'Новая папка'
  if (props.type === 'markdown')
    return 'Новая заметка'
  return 'Новый скетч'
})

const icon = computed(() => {
  if (props.type === 'folder')
    return 'mdi:folder-plus-outline'
  if (props.type === 'markdown')
    return 'mdi:file-document-plus-outline'
  return 'mdi:draw-pen'
})

const placeholder = computed(() => {
  if (props.type === 'folder')
    return 'Название папки...'
  if (props.type === 'markdown')
    return 'Название заметки...'
  return 'Название скетча...'
})

function submit(): void {
  const trimmed = title.value.trim()
  if (!trimmed)
    return
  emit('create', trimmed)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="dialogTitle"
    :icon="icon"
    :max-width="400"
    description="Введите название для нового элемента"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="create-form" @submit.prevent="submit">
      <KitInput
        v-model="title"
        v-focus
        :placeholder="placeholder"
        autocomplete="off"
      />

      <div v-if="parentId" class="hint">
        <Icon icon="mdi:folder-outline" />
        Будет создано внутри папки
      </div>

      <div class="actions">
        <KitBtn variant="text" type="button" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn type="submit" :disabled="!title.trim()">
          Создать
        </KitBtn>
      </div>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  margin-top: -8px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
