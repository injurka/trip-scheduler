<script setup lang="ts">
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import type { TripNote } from '~/shared/services/api/model/types'
import { nextTick, ref, watch } from 'vue'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { createDataviewJsNodeView } from '../../lib/dataviewjs-renderer'

const props = defineProps<{
  noteId: string
  content: string | null
  readonly: boolean
  dataviewNotes: TripNote[]
  dataviewRefreshKey: number
}>()

const emit = defineEmits<{
  'update:content': [noteId: string, value: string]
  'uploadImage': [file: File]
  'toggleTask': [payload: { noteId: string, lineIndex: number }]
}>()

const localContent = ref(props.content ?? '')
const containerRef = ref<HTMLElement | null>(null)

// Обновляем локальный контент ТОЛЬКО при смене самой заметки.
// Если сервер возвращает ответ, пока мы печатаем - мы его игнорируем
watch(() => props.noteId, () => {
  localContent.value = props.content ?? ''
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
  })
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

function createCodeBlockNodeView(node: ProseMirrorNode): NodeView | undefined {
  if (String(node.attrs.language ?? '').toLowerCase() !== 'dataviewjs')
    return undefined

  return createDataviewJsNodeView(node, {
    getNotes: () => props.dataviewNotes,
    currentNoteId: props.noteId,
    readonly: () => props.readonly,
    toggleTask: payload => emit('toggleTask', payload),
  })
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
  <div ref="containerRef" class="md-editor-container" @paste="handlePaste">
    <KitInlineMdEditorWrapper
      :model-value="localContent"
      :readonly="readonly"
      :code-block-node-view="createCodeBlockNodeView"
      :code-block-refresh-key="dataviewRefreshKey"
      placeholder="Начните писать заметку..."
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<style scoped lang="scss">
.md-editor-container {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 100%;
  height: auto;
  padding: 24px;
  box-sizing: border-box;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
