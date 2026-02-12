<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { resolveApiUrl } from '~/shared/lib/url'
import { useBlogStore } from '../store/blog.store'

interface IProps {
  postId: string
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

const isUploading = computed(() => store.isUploading)
const images = computed(() => store.postImages)

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length)
    return
  const file = input.files[0]

  try {
    await store.uploadImage(file, props.postId, 'content')
    toast.success('Загружено')
  }
  catch {
    toast.error('Ошибка загрузки')
  }
  finally {
    input.value = ''
  }
}

async function handleDelete(imageId: string) {
  const isConfirmed = await confirm({
    title: 'Удалить файл?',
    description: 'Действие необратимо.',
    type: 'danger',
  })

  if (isConfirmed) {
    await store.deleteImage(imageId)
  }
}

function getFullUrl(url: string) {
  return resolveApiUrl(url)
}

function copyMarkdownLink(image: any) {
  const fullUrl = getFullUrl(image.url)
  const md = `![${image.originalName}](${fullUrl})`
  copy(md)
  toast.info('Ссылка скопирована')
}

function insertToEditor(image: any) {
  const fullUrl = getFullUrl(image.url)
  const markdown = `![${image.originalName}](${fullUrl})`
  emit('insert', markdown)
}
</script>

<template>
  <div class="media-manager">
    <div class="mm-header">
      <span class="mm-title">Медиа файлы</span>
      <div class="mm-controls">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileChange"
        >
        <KitBtn
          variant="tonal"
          size="sm"
          :loading="isUploading"
          @click="triggerUpload"
        >
          <Icon icon="mdi:cloud-upload-outline" />
          Загрузить
        </KitBtn>
      </div>
    </div>

    <div class="mm-content">
      <div v-if="store.isImagesLoading" class="state-msg">
        <Icon icon="mdi:loading" class="spin" />
      </div>

      <div v-else-if="images.length === 0" class="state-msg empty">
        <Icon icon="mdi:image-off-outline" />
        <span>Нет файлов</span>
      </div>

      <div v-else class="mm-grid">
        <div v-for="img in images" :key="img.id" class="mm-card">
          <KitImage :src="img.url" object-fit="cover" class="mm-img" />

          <div class="mm-overlay">
            <div class="mm-actions">
              <button title="Вставить в текст" @click="insertToEditor(img)">
                <Icon icon="mdi:text-box-plus-outline" />
              </button>
              <button title="Сделать обложкой" @click="$emit('setCover', img.url)">
                <Icon icon="mdi:image-frame" />
              </button>
              <button title="Копировать Markdown" @click="copyMarkdownLink(img)">
                <Icon icon="mdi:link-variant" />
              </button>
              <button class="danger" title="Удалить" @click="handleDelete(img.id)">
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>
            <div class="mm-info" :title="img.originalName">
              {{ img.originalName }}
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
  padding: 16px 24px;
}

.mm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.mm-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.mm-content {
  min-height: 120px;
  max-height: 280px;
  overflow-y: auto;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 3px;
  }
}

.mm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.mm-card {
  position: relative;
  aspect-ratio: 1;
  background: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  &:hover .mm-overlay {
    opacity: 1;
  }
}

.mm-img {
  width: 100%;
  height: 100%;
  display: block;
}

.mm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 8px;
}

.mm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;

  button {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 1.1rem;

    &:hover {
      background: rgba(255, 255, 255, 0.9);
      color: black;
    }

    &.danger:hover {
      background: var(--fg-error-color);
      color: white;
    }
  }
}

.mm-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  pointer-events: none;
}

.state-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--fg-tertiary-color);
  gap: 8px;
  font-size: 0.9rem;

  &.empty {
    opacity: 0.7;
  }
}

.spin {
  animation: spin 1s linear infinite;
  font-size: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
