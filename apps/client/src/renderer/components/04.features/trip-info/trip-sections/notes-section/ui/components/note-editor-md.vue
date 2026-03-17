<script setup lang="ts">
import { ref, watch } from 'vue'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'

const props = defineProps<{
  noteId: string
  content: string | null
  readonly: boolean
}>()

const emit = defineEmits<{
  'update:content': [noteId: string, value: string]
  'uploadImage': [file: File]
}>()

const localContent = ref(props.content ?? '')

// Обновляем локальный контент ТОЛЬКО при смене самой заметки.
// Если сервер возвращает ответ, пока мы печатаем - мы его игнорируем
watch(() => props.noteId, () => {
  localContent.value = props.content ?? ''
}, { immediate: true })

// Если мы в ReadOnly - разрешаем обновление извне
watch(() => props.content, (newVal) => {
  if (props.readonly && newVal !== localContent.value) {
    localContent.value = newVal ?? ''
  }
})

function handleUpdate(val: string) {
  localContent.value = val
  emit('update:content', props.noteId, val)
}

function handlePaste(event: ClipboardEvent) {
  if (props.readonly)
    return
  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        emit('uploadImage', file)
      }
    }
  }
}
</script>

<template>
  <div class="md-editor-container" @paste="handlePaste">
    <KitInlineMdEditorWrapper
      :model-value="localContent"
      :readonly="readonly"
      placeholder="Начните писать заметку..."
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<style scoped lang="scss">
.md-editor-container {
  min-height: 100%;
  height: auto;
  padding: 24px;
}
</style>
