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
}>()

const localContent = ref(props.content ?? '')

watch(() => props.content, (newVal) => {
  const val = newVal ?? ''
  if (val !== localContent.value) {
    localContent.value = val
  }
})

function handleUpdate(val: string) {
  localContent.value = val
  emit('update:content', props.noteId, val)
}
</script>

<template>
  <div class="md-editor-container">
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
  height: 100%;
  padding: 24px;
}
</style>
