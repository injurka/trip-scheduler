<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useElementHover, useEventListener, useFileDialog } from '@vueuse/core'

const props = withDefaults(defineProps<{
  modelValue: File | null
  accept?: string
  multiple?: boolean
}>(), {
  accept: '.png,.jpg,.jpeg,.pdf',
  multiple: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | null): void
}>()

const { files, open, reset } = useFileDialog({
  accept: props.accept,
  multiple: props.multiple,
})

const fileInputAreaRef = ref<HTMLElement | null>(null)
const isDragOver = ref(false)
const isHovered = useElementHover(fileInputAreaRef)

watch(files, (newFiles) => {
  if (newFiles && newFiles.length > 0)
    emit('update:modelValue', newFiles[0])
})

watch(() => props.modelValue, (newValue) => {
  if (newValue === null)
    reset()
})

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        const fileExtension = file.type.split('/')[1] || 'png'
        const namedFile = new File([file], `pasted-image-${Date.now()}.${fileExtension}`, { type: file.type })
        emit('update:modelValue', namedFile)
        return
      }
    }
  }
  useToast().info('В буфере обмена не найдено изображений для вставки.')
}

useEventListener(document, 'paste', (event: ClipboardEvent) => {
  if (isHovered.value)
    handlePaste(event)
})

function onDrop(event: DragEvent) {
  isDragOver.value = false
  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0)
    emit('update:modelValue', droppedFiles[0])
}

function clearFile() {
  emit('update:modelValue', null)
}

const componentClasses = computed(() => ({
  'file-input-area': true,
  'is-drag-over': isDragOver.value,
}))
</script>

<template>
  <div
    ref="fileInputAreaRef"
    :class="componentClasses"
    tabindex="0"
    @click="() => open()"
    @paste="handlePaste"
    @dragover.prevent="isDragOver = true"
    @dragleave.prevent="isDragOver = false"
    @drop.prevent="onDrop"
    @keydown.enter.prevent="() => open()"
  >
    <Icon icon="mdi:cloud-upload-outline" />
    <template v-if="!modelValue">
      <p>
        <slot>Нажмите, чтобы выбрать файл, или перетащите его сюда</slot>
      </p>
    </template>
    <div v-else class="file-name-wrapper">
      <p class="file-name">
        {{ modelValue.name }} ({{ (modelValue.size / 1024).toFixed(1) }} KB)
      </p>
      <button class="clear-file-btn" title="Удалить файл" @click.stop="clearFile">
        <Icon icon="mdi:close-circle" />
      </button>
    </div>
    <span class="supported-formats">
      <slot name="supported-formats">Поддерживаются: {{ accept }}</slot>
    </span>
  </div>
</template>

<style scoped lang="scss">
.file-input-area {
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1.5rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  outline: none;
  min-height: 170px;

  &:hover,
  &.is-drag-over,
  &:focus-visible {
    border-color: var(--border-focus-color);
    background-color: var(--bg-tertiary-color);
  }

  &.is-drag-over {
    border-style: solid;
  }

  .iconify {
    font-size: 2rem;
    color: var(--fg-tertiary-color);
    margin-bottom: 0.5rem;
  }
  p {
    font-weight: 500;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
    margin: 0;
  }
  .file-name {
    color: var(--fg-accent-color);
  }
  .supported-formats {
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
    margin-top: 0.25rem;
  }
}

.file-name-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clear-file-btn {
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  line-height: 1;
  &:hover {
    color: var(--fg-error-color);
  }
}
</style>
