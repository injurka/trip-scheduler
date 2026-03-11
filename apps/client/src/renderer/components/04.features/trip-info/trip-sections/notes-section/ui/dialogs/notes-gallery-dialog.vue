<script setup lang="ts">
import type { NoteImageUsage } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { useClipboard, useDropZone } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useRequest, useRequestStatusByPrefix } from '~/plugins/request'
import { resolveApiUrl } from '~/shared/lib/url'

const props = defineProps<{
  visible: boolean
  tripId: string
  images: NoteImageUsage[]
  readonly: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'refresh': []
  'insertImage': [markdownSnippet: string]
}>()

const dropZoneRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: handleDroppedFiles })

const UPLOAD_KEY_PREFIX = 'notes:upload-image'
const isUploading = useRequestStatusByPrefix(UPLOAD_KEY_PREFIX)

async function uploadFiles(files: File[]): Promise<void> {
  if (props.readonly)
    return
  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  if (!imageFiles.length)
    return

  await Promise.allSettled(
    imageFiles.map(file =>
      useRequest({
        key: `${UPLOAD_KEY_PREFIX}:${file.name}-${Date.now()}`,
        cancelPrevious: false,
        fn: db => db.files.uploadFile(file, props.tripId, 'trip', 'notes'),
      }),
    ),
  )

  emit('refresh')
  useToast().success(`Загружено изображений: ${imageFiles.length}`)
}

function handleDroppedFiles(files: File[] | null): void {
  if (files?.length)
    uploadFiles(files)
}

function handleFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    uploadFiles(Array.from(input.files))
    input.value = ''
  }
}

function openFilePicker(): void {
  fileInputRef.value?.click()
}

const { copy } = useClipboard()

function copyMarkdownLink(url: string): void {
  const absoluteUrl = resolveApiUrl(url)
  copy(`![image](${absoluteUrl})`)
  useToast().success('Markdown-ссылка скопирована')
}

function copyUrl(url: string): void {
  const absoluteUrl = resolveApiUrl(url)
  copy(`${absoluteUrl}`)
  useToast().success('Ссылка скопирована')
}

function insertIntoEditor(url: string): void {
  const absoluteUrl = resolveApiUrl(url)
  emit('insertImage', `![image](${absoluteUrl})`)
  emit('update:visible', false)
}

async function deleteImage(id: string): Promise<void> {
  const usedCount = props.images.find(img => img.id === id)?.usedIn.length ?? 0
  const description = usedCount > 0
    ? `Изображение используется в ${usedCount} заметках. После удаления ссылки станут битыми.`
    : 'Изображение будет удалено навсегда.'

  const isConfirmed = await useConfirm()({
    title: 'Удалить изображение?',
    description,
    type: 'danger',
  })
  if (!isConfirmed)
    return

  await useRequest({
    key: `notes:delete-image:${id}`,
    fn: db => db.files.deleteFile(id),
    onSuccess: () => {
      emit('refresh')
    },
    onError: ({ error }) => {
      useToast().error(`Ошибка удаления: ${error.customMessage}`)
    },
  })
}

const viewerVisible = ref(false)
const viewerIndex = ref(0)

const viewerImages = computed(() => {
  return props.images.map(img => ({
    url: img.sources.original,
    variants: img.sources,
  }))
})

function openPreview(index: number): void {
  viewerIndex.value = index
  viewerVisible.value = true
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Галерея изображений"
    icon="mdi:image-multiple-outline"
    :max-width="820"
    :persistent="viewerVisible"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="gallery-wrapper">
      <div
        v-if="!readonly"
        ref="dropZoneRef"
        class="upload-area"
        :class="{ 'is-dragover': isOverDropZone, 'is-uploading': isUploading }"
        role="button"
        tabindex="0"
        @click="openFilePicker"
        @keydown.enter.prevent="openFilePicker"
        @keydown.space.prevent="openFilePicker"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="sr-only"
          @change="handleFileInputChange"
        >
        <Icon
          :icon="isUploading ? 'mdi:loading' : 'mdi:cloud-upload-outline'"
          class="upload-icon"
          :class="{ spin: isUploading }"
        />
        <p v-if="isUploading">
          Загрузка...
        </p>
        <p v-else>
          Перетащите изображения или <span class="upload-link">нажмите для выбора</span>
        </p>
      </div>

      <div v-if="images.length === 0" class="empty-state">
        <Icon icon="mdi:image-off-outline" class="empty-icon" />
        <p>Загруженных изображений пока нет</p>
      </div>

      <div v-else class="images-grid">
        <div v-for="(img, index) in images" :key="img.id" class="image-card">
          <button class="img-preview-btn" @click="openPreview(index)">
            <KitImage
              :src="img.sources.small ?? img.sources.original"
              object-fit="cover"
              class="img-thumb"
            />
          </button>

          <div class="image-meta">
            <span
              v-if="img.usedIn.length === 0"
              class="badge badge--unused"
              title="Не используется ни в одной заметке"
            >
              Не используется
            </span>
            <span
              v-else
              class="badge badge--used"
              :title="img.usedIn.map(n => n.title).join(', ')"
            >
              {{ img.usedIn.length }} {{ img.usedIn.length === 1 ? 'заметка' : 'заметки' }}
            </span>
          </div>

          <div class="image-actions">
            <KitBtn
              v-if="!readonly"
              variant="tonal"
              size="sm"
              icon="mdi:file-document-arrow-right-outline"
              title="Вставить в редактор"
              @click="insertIntoEditor(img.sources.original)"
            />
            <KitBtn
              variant="tonal"
              size="sm"
              icon="mdi:language-markdown-outline"
              title="Скопировать MD-ссылку"
              @click="copyMarkdownLink(img.sources.original)"
            />
            <KitBtn
              variant="tonal"
              size="sm"
              icon="mdi:link-variant"
              title="Скопировать URL"
              @click="copyUrl(img.sources.original)"
            />
            <KitBtn
              v-if="!readonly"
              variant="text"
              size="sm"
              icon="mdi:trash-can-outline"
              class="btn-danger"
              title="Удалить"
              @click="deleteImage(img.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <KitImageViewer
      v-model:visible="viewerVisible"
      v-model:current-index="viewerIndex"
      :images="viewerImages"
      :show-quality-selector="false"
      :enable-thumbnails="false"
    />
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.gallery-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.upload-area {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  text-align: center;
  color: var(--fg-secondary-color);
  background: var(--bg-secondary-color);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &:hover,
  &:focus-visible {
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
    outline: none;
  }

  &.is-dragover {
    border-color: var(--fg-accent-color);
    background: var(--bg-accent-overlay-color);
  }

  &.is-uploading {
    pointer-events: none;
    opacity: 0.7;
  }

  .upload-icon {
    font-size: 1.5rem;
    &.spin {
      animation: spin 0.8s linear infinite;
    }
  }

  p {
    margin: 0;
    font-size: 0.875rem;
  }

  .upload-link {
    color: var(--fg-accent-color);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 16px;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;

  .empty-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  p {
    margin: 0;
  }
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  max-height: 55vh;
  overflow-y: auto;
}

.image-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  background: var(--bg-secondary-color);
  transition: box-shadow 0.15s;

  &:hover {
    box-shadow: var(--shadow-s, 0 2px 8px rgba(0, 0, 0, 0.1));
  }
}

.img-preview-btn {
  display: block;
  width: 100%;
  height: 100px;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  overflow: hidden;

  .img-thumb {
    width: 100%;
    height: 100%;
  }
}

.image-meta {
  padding: 6px 8px 0;
}

.badge {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-weight: 500;

  &--unused {
    background: var(--bg-warning-overlay-color, #fff3cd);
    color: var(--fg-warning-color);
  }

  &--used {
    background: var(--bg-success-overlay-color, #d1f7e7);
    color: var(--fg-success-color);
  }
}

.image-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 6px;

  .btn-danger {
    margin-left: auto;
    color: var(--fg-error-color);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
