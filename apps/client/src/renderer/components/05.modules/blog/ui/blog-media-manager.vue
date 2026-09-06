<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { resolveApiUrl } from '~/shared/lib/url'
import { useBlogStore } from '../store/blog.store'

interface IProps {
  postId: string
  currentCoverUrl?: string
}

const props = defineProps<IProps>()

const emit = defineEmits<{
  (e: 'insert', markdown: string): void
  (e: 'setCover', url: string): void
}>()

const store = useBlogStore()
const { copy } = useClipboard()
const toast = useToast()
const confirm = useConfirm()
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDraggingOver = ref(false)

const isUploading = computed(() => store.isUploading)
const images = computed(() => store.postImages)

function triggerUpload() {
  fileInputRef.value?.click()
}

async function uploadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    toast.error('Пожалуйста, выберите изображение')
    return
  }

  try {
    await store.uploadImage(file, props.postId, 'content')
    toast.success('Изображение загружено')
  }
  catch {
    toast.error('Ошибка загрузки изображения')
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length)
    return

  const file = input.files[0]
  await uploadFile(file)
  input.value = ''
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = false

  if (e.dataTransfer?.files?.length) {
    const file = e.dataTransfer.files[0]
    await uploadFile(file)
  }
}

async function handleDelete(imageId: string) {
  const isConfirmed = await confirm({
    title: 'Удалить изображение?',
    description: 'Файл будет удален из хранилища. Это действие необратимо.',
    type: 'danger',
  })

  if (isConfirmed) {
    await store.deleteImage(imageId)
    toast.info('Изображение удалено')
  }
}

function getFullUrl(url: string) {
  return resolveApiUrl(url)
}

function copyMarkdownLink(image: any) {
  const fullUrl = getFullUrl(image.url)
  const md = `![${image.originalName || 'image'}](${fullUrl})`
  copy(md)
  toast.info('Markdown-ссылка скопирована')
}

function insertToEditor(image: any) {
  const fullUrl = getFullUrl(image.url)
  const markdown = `![${image.originalName || 'image'}](${fullUrl})`
  emit('insert', markdown)
  toast.success('Вставлено в статью')
}
</script>

<template>
  <div class="media-manager">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileChange"
    >

    <!-- Upload Dropzone -->
    <div
      class="upload-dropzone"
      :class="{ 'is-dragging': isDraggingOver, 'is-loading': isUploading }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerUpload"
    >
      <div v-if="isUploading" class="dropzone-inner">
        <Icon icon="mdi:loading" class="spinner" />
        <span class="dropzone-text">Загрузка изображения...</span>
      </div>
      <div v-else class="dropzone-inner">
        <div class="dropzone-icon">
          <Icon icon="mdi:cloud-upload-outline" />
        </div>
        <div class="dropzone-info">
          <span class="dropzone-title">Нажмите или перетащите фото</span>
          <span class="dropzone-subtitle">JPG, PNG, WebP, GIF</span>
        </div>
      </div>
    </div>

    <!-- Gallery section -->
    <div class="gallery-section">
      <div class="gallery-header">
        <span class="gallery-title">
          Файлы статьи
          <span v-if="images.length > 0" class="count-badge">{{ images.length }}</span>
        </span>
      </div>

      <div class="gallery-body">
        <div v-if="store.isImagesLoading" class="state-placeholder">
          <Icon icon="mdi:loading" class="spinner" />
          <span>Загрузка медиа...</span>
        </div>

        <div v-else-if="images.length === 0" class="state-placeholder empty">
          <Icon icon="mdi:image-multiple-outline" class="empty-icon" />
          <span class="empty-title">Нет загруженных файлов</span>
          <span class="empty-subtitle">Загрузите изображения, чтобы использовать их в тексте или установить как обложку</span>
        </div>

        <div v-else class="media-grid">
          <div
            v-for="img in images"
            :key="img.id"
            class="media-card"
            :class="{ 'is-cover': currentCoverUrl === img.url }"
          >
            <KitImage :src="img.url" object-fit="cover" class="media-preview-img" />

            <div v-if="currentCoverUrl === img.url" class="cover-badge">
              <Icon icon="mdi:star" />
              <span>Обложка</span>
            </div>

            <div class="media-overlay">
              <div class="media-actions">
                <KitTooltip text="Вставить в текст">
                  <button class="action-btn action-insert" @click="insertToEditor(img)">
                    <Icon icon="mdi:text-box-plus-outline" />
                  </button>
                </KitTooltip>

                <KitTooltip text="Сделать обложкой">
                  <button
                    class="action-btn"
                    :class="{ active: currentCoverUrl === img.url }"
                    @click="$emit('setCover', img.url)"
                  >
                    <Icon icon="mdi:image-frame" />
                  </button>
                </KitTooltip>

                <KitTooltip text="Копировать Markdown">
                  <button class="action-btn" @click="copyMarkdownLink(img)">
                    <Icon icon="mdi:link-variant" />
                  </button>
                </KitTooltip>

                <KitTooltip text="Удалить">
                  <button class="action-btn action-danger" @click="handleDelete(img.id)">
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </KitTooltip>
              </div>

              <div class="media-filename" :title="img.originalName">
                {{ img.originalName }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.media-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.upload-dropzone {
  border: 2px dashed var(--border-secondary-color);
  background: var(--bg-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover,
  &.is-dragging {
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }

  &.is-loading {
    pointer-events: none;
    opacity: 0.7;
  }
}

.dropzone-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.dropzone-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--r-s);
  background: var(--bg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 1.3rem;
  flex-shrink: 0;
}

.dropzone-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropzone-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-primary-color);
}

.dropzone-subtitle {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}

.dropzone-text {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
}

.gallery-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.gallery-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background: var(--bg-tertiary-color);
  font-size: 0.75rem;
  color: var(--fg-primary-color);
  font-weight: 600;
}

.gallery-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.state-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: var(--fg-secondary-color);
  gap: 8px;
  font-size: 0.85rem;

  &.empty {
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.4;
    margin-bottom: 4px;
  }

  .empty-title {
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .empty-subtitle {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    max-width: 260px;
    line-height: 1.4;
  }
}

.spinner {
  font-size: 1.8rem;
  color: var(--fg-accent-color);
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

.media-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.media-card {
  position: relative;
  aspect-ratio: 16 / 11;
  background: var(--bg-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s ease;

  &.is-cover {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }

  &:hover .media-overlay {
    opacity: 1;
  }
}

.cover-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  border-radius: var(--r-xs);
  color: var(--fg-warning-color, #f5b971);
  font-size: 0.7rem;
  font-weight: 600;
}

.media-preview-img {
  width: 100%;
  height: 100%;
  display: block;
}

.media-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 15, 20, 0.75);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  opacity: 0;
  transition: opacity 0.15s ease;
  padding: 8px;
}

.media-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.15s ease;

  &:hover {
    background: #fff;
    color: #000;
    transform: translateY(-1px);
  }

  &.active {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #fff;
  }

  &.action-insert:hover {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #fff;
  }

  &.action-danger:hover {
    background: var(--fg-error-color);
    border-color: var(--fg-error-color);
    color: #fff;
  }
}

.media-filename {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
</style>
