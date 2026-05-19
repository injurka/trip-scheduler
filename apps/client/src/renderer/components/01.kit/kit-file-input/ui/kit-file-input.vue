<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useElementHover, useEventListener, useFileDialog } from '@vueuse/core'

const props = withDefaults(defineProps<{
  modelValue: File | null
  accept?: string
  multiple?: boolean
  previewUrl?: string | null
  loading?: boolean
  disabled?: boolean
}>(), {
  accept: '.png,.jpg,.jpeg,.pdf',
  multiple: false,
  previewUrl: null,
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | null): void
}>()

const toast = useToast()

const { files, open, reset } = useFileDialog({
  accept: props.accept,
  multiple: props.multiple,
})

const fileInputAreaRef = ref<HTMLElement | null>(null)
const isDragOver = ref(false)
const isFocused = ref(false)
const isHovered = useElementHover(fileInputAreaRef)
const localPreviewUrl = ref<string | null>(null)

const isBusy = computed(() => props.loading || props.disabled)
const hasValue = computed(() => Boolean(props.modelValue || props.previewUrl || localPreviewUrl.value))
const previewUrl = computed(() => localPreviewUrl.value || props.previewUrl || null)

const fileName = computed(() => {
  if (props.modelValue?.name)
    return props.modelValue.name

  if (props.previewUrl)
    return 'Загруженное изображение'

  return ''
})

const fileSize = computed(() => {
  if (!props.modelValue)
    return ''

  return `${(props.modelValue.size / 1024).toFixed(1)} KB`
})

const isImagePreview = computed(() => {
  if (previewUrl.value)
    return true

  return props.modelValue?.type?.startsWith('image/') ?? false
})

watch(files, (newFiles) => {
  if (newFiles && newFiles.length > 0)
    emit('update:modelValue', newFiles[0])
})

watch(() => props.modelValue, (newValue) => {
  revokeLocalPreview()

  if (newValue === null) {
    if (!props.previewUrl)
      reset()

    return
  }

  if (newValue.type.startsWith('image/'))
    localPreviewUrl.value = URL.createObjectURL(newValue)
}, { immediate: true })

function revokeLocalPreview() {
  if (!localPreviewUrl.value)
    return

  URL.revokeObjectURL(localPreviewUrl.value)
  localPreviewUrl.value = null
}

onBeforeUnmount(revokeLocalPreview)

function openDialog() {
  if (isBusy.value)
    return

  open()
}

function applyFile(file: File) {
  emit('update:modelValue', file)
}

function handlePaste(event: ClipboardEvent) {
  if (isBusy.value)
    return

  event.preventDefault()
  event.stopPropagation()

  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/'))
      continue

    const file = item.getAsFile()
    if (!file)
      continue

    const fileExtension = file.type.split('/')[1] || 'png'
    const namedFile = new File(
      [file],
      `pasted-image-${Date.now()}.${fileExtension}`,
      { type: file.type },
    )

    applyFile(namedFile)
    return
  }

  toast.info('В буфере обмена не найдено изображений для вставки.')
}

useEventListener(document, 'paste', (event: ClipboardEvent) => {
  if (isHovered.value || isFocused.value)
    handlePaste(event)
})

function onDrop(event: DragEvent) {
  if (isBusy.value)
    return

  isDragOver.value = false

  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0)
    applyFile(droppedFiles[0])
}

function clearFile() {
  if (isBusy.value)
    return

  emit('update:modelValue', null)
  reset()
}

const componentClasses = computed(() => ({
  'file-input-area': true,
  'is-drag-over': isDragOver.value,
  'is-disabled': props.disabled,
  'is-loading': props.loading,
  'has-preview': Boolean(previewUrl.value),
}))
</script>

<template>
  <div
    ref="fileInputAreaRef"
    :class="componentClasses"
    tabindex="0"
    @click="openDialog"
    @focus="isFocused = true"
    @blur="isFocused = false"
    @dragover.prevent="!isBusy && (isDragOver = true)"
    @dragleave.prevent="isDragOver = false"
    @drop.prevent="onDrop"
    @keydown.enter.prevent="openDialog"
    @keydown.space.prevent="openDialog"
  >
    <div v-if="isImagePreview && previewUrl" class="preview-wrapper">
      <img
        :src="previewUrl"
        :alt="fileName || 'Preview'"
        class="preview-image"
      >
    </div>

    <div class="file-input-content">
      <div class="file-input-icon">
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:cloud-upload-outline'" :class="{ spinning: loading }" />
      </div>

      <template v-if="!hasValue">
        <p class="title">
          <slot>Нажмите, чтобы выбрать файл, вставьте из буфера или перетащите сюда</slot>
        </p>
      </template>

      <template v-else>
        <div class="file-meta">
          <p class="file-name">
            {{ fileName }}
          </p>
          <span v-if="fileSize" class="file-size">
            {{ fileSize }}
          </span>
        </div>

        <div class="actions">
          <button
            type="button"
            class="action-btn"
            :disabled="isBusy"
            @click.stop="openDialog"
          >
            {{ previewUrl ? 'Заменить файл' : 'Выбрать файл' }}
          </button>

          <button
            type="button"
            class="action-btn action-btn--danger"
            :disabled="isBusy"
            @click.stop="clearFile"
          >
            Удалить
          </button>
        </div>
      </template>

      <span class="supported-formats">
        <slot name="supported-formats">
          Поддерживаются: {{ accept }}
        </slot>
      </span>
    </div>

    <div v-if="loading" class="loading-overlay">
      <Icon icon="mdi:loading" class="spinning" />
      <span>Загружаем файл…</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.file-input-area {
  position: relative;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
  text-align: center;
  flex-grow: 1;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
  display: flex;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
  outline: none;
  min-height: 220px;
  background: var(--bg-secondary-color);
  overflow: hidden;

  &:hover,
  &.is-drag-over,
  &:focus-visible {
    border-color: var(--border-focus-color);
    background-color: var(--bg-tertiary-color);
  }

  &.is-drag-over {
    border-style: solid;
    transform: translateY(-1px);
  }

  &.is-disabled,
  &.is-loading {
    cursor: default;
  }

  &.is-disabled {
    opacity: 0.6;
  }
}

.preview-wrapper {
  width: 100%;
  border-radius: calc(var(--r-l) - 4px);
  overflow: hidden;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 260px;
  object-fit: cover;
}

.file-input-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.file-input-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--bg-tertiary-color);
  color: var(--fg-tertiary-color);
  flex-shrink: 0;

  .iconify {
    font-size: 1.75rem;
  }
}

.title {
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  margin: 0;
  max-width: 32rem;
}

.file-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.file-name {
  margin: 0;
  font-weight: 600;
  color: var(--fg-accent-color);
  font-size: 0.95rem;
  word-break: break-word;
}

.file-size {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.action-btn {
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  padding: 0.55rem 0.9rem;
  border-radius: var(--r-s);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--border-focus-color);
    color: var(--fg-accent-color);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.action-btn--danger {
  color: var(--fg-error-color);

  &:hover:not(:disabled) {
    border-color: var(--border-error-color);
    background: var(--bg-error-color);
    color: var(--fg-primary-color);
  }
}

.supported-formats {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--bg-primary-color-rgb), 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--fg-primary-color);
  font-weight: 600;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
