<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { TripMedia } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useRequest } from '~/plugins/request'
import { TripMediaPlacement } from '~/shared/types/models/trip'

interface Props {
  photos?: string[]
  readonly: boolean
  tripId?: string
  title?: string
  icon?: string
  emptyDropzoneText?: string
  emptyReadonlyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  photos: () => [],
  tripId: '',
  title: 'Фотографии',
  icon: 'mdi:camera-outline',
  emptyDropzoneText: 'Нажмите или перетащите фото сюда',
  emptyReadonlyText: 'Нет добавленных фотографий',
})

const emit = defineEmits<{
  (e: 'update:photos', value: string[]): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const isLinkDialogOpen = ref(false)
const linkInput = ref('')
const isDragOver = ref(false)

const photosList = computed(() => props.photos || [])

const maxVisibleThumbnails = 6
const visiblePhotos = computed(() => photosList.value.slice(0, maxVisibleThumbnails))
const remainingPhotosCount = computed(() =>
  Math.max(0, photosList.value.length - maxVisibleThumbnails),
)

const imageViewer = useImageViewer({
  enableKeyboard: true,
})

const viewerImages = computed<ImageViewerImage[]>(() =>
  photosList.value.map((url, i) => ({
    url,
    alt: `${props.title} ${i + 1}`,
    caption: `${props.title}: ${i + 1} из ${photosList.value.length}`,
  })),
)

function openViewer(index: number) {
  imageViewer.open(viewerImages.value, index)
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function uploadFileItem(file: File): Promise<string | null> {
  if (!props.tripId) {
    useToast().error('Не удалось определить путешествие для сохранения фото.')
    return null
  }

  const res = await useRequest<TripMedia>({
    key: `booking-photo-upload:${crypto.randomUUID()}`,
    cancelPrevious: false,
    fn: db => db.files.uploadFile(
      file,
      props.tripId,
      'trip',
      TripMediaPlacement.ROUTE,
    ),
    onError: ({ error }) => {
      useToast().error(`Ошибка при загрузке фото: ${error.customMessage || 'Ошибка сети'}`)
    },
  })

  return res?.url || null
}

async function handleFiles(files: FileList | File[]) {
  const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'))
  if (fileArray.length === 0) {
    useToast().warn('Пожалуйста, выберите файлы изображений')
    return
  }

  isUploading.value = true
  try {
    const uploadPromises = fileArray.map(file => uploadFileItem(file))
    const uploadedUrls = await Promise.all(uploadPromises)
    const validUrls = uploadedUrls.filter((url): url is string => Boolean(url))

    if (validUrls.length > 0) {
      emit('update:photos', [...photosList.value, ...validUrls])
      useToast().success(`Загружено фото: ${validUrls.length}`)
    }
  }
  finally {
    isUploading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    handleFiles(target.files)
  }
}

function onDragOver(e: DragEvent) {
  if (props.readonly || isUploading.value)
    return
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave(e: DragEvent) {
  if (props.readonly)
    return
  e.preventDefault()
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  if (props.readonly || isUploading.value)
    return
  e.preventDefault()
  isDragOver.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files)
  }
}

function deletePhoto(index: number) {
  const updated = photosList.value.filter((_, i) => i !== index)
  emit('update:photos', updated)
}

function isValidUrl(str: string) {
  return URL.canParse(str)
}

function handleAddLink() {
  const trimmed = linkInput.value.trim()
  if (!isValidUrl(trimmed)) {
    useToast().error('Введите корректную ссылку на изображение (URL)')
    return
  }

  emit('update:photos', [...photosList.value, trimmed])
  linkInput.value = ''
  isLinkDialogOpen.value = false
  useToast().success('Фото добавлено по ссылке')
}
</script>

<template>
  <div
    class="booking-photos"
    :class="{ 'is-drag-over': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="photos-header">
      <div class="photos-title">
        <Icon :icon="icon" class="title-icon" />
        <span class="title-text">{{ title }}</span>
        <span v-if="photosList.length > 0" class="photos-count-tag">
          {{ photosList.length }}
        </span>
      </div>

      <div v-if="!readonly" class="photos-actions">
        <KitBtn
          variant="subtle"
          size="xs"
          icon="mdi:upload"
          :loading="isUploading"
          title="Загрузить фотографии с устройства"
          @click.stop="triggerFileInput"
        >
          Загрузить
        </KitBtn>

        <KitBtn
          variant="subtle"
          size="xs"
          icon="mdi:link-variant"
          :disabled="isUploading"
          title="Добавить фото по URL ссылке"
          @click.stop="isLinkDialogOpen = true"
        >
          По ссылке
        </KitBtn>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden-file-input"
      :disabled="isUploading"
      @change="onFileInputChange"
    >

    <!-- Empty state for edit mode -->
    <div
      v-if="photosList.length === 0 && !readonly"
      class="photos-dropzone"
      @click="triggerFileInput"
    >
      <div class="dropzone-inner">
        <Icon
          :icon="isUploading ? 'mdi:loading' : 'mdi:camera-plus-outline'"
          class="dropzone-icon"
          :class="{ 'is-spinning': isUploading }"
        />
        <div class="dropzone-text">
          <span v-if="isUploading">Загрузка фотографий...</span>
          <span v-else>{{ emptyDropzoneText }}</span>
        </div>
        <span v-if="!isUploading" class="dropzone-hint">PNG, JPG, WEBP</span>
      </div>
    </div>

    <!-- Gallery grid -->
    <div v-else-if="photosList.length > 0" class="photos-grid">
      <div
        v-for="(photoUrl, index) in visiblePhotos"
        :key="`${photoUrl}-${index}`"
        class="photo-thumb-wrapper"
        @click="openViewer(index)"
      >
        <KitImage
          :src="photoUrl"
          :alt="`${title} ${index + 1}`"
          object-fit="cover"
          class="photo-thumb-img"
        />

        <!-- Overlay with actions -->
        <div v-if="!readonly" class="photo-thumb-overlay" @click.stop>
          <KitTooltip text="Удалить фото">
            <button
              class="photo-delete-btn"
              title="Удалить фото"
              @click.stop="deletePhoto(index)"
            >
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </KitTooltip>
        </div>
      </div>

      <!-- More photos counter pill if overflow -->
      <div
        v-if="remainingPhotosCount > 0"
        class="photo-thumb-wrapper more-photos-thumb"
        @click="openViewer(maxVisibleThumbnails)"
      >
        <KitImage
          :src="photosList[maxVisibleThumbnails]"
          alt="Остальные фото"
          object-fit="cover"
          class="photo-thumb-img"
        />
        <div class="more-photos-overlay">
          <Icon icon="mdi:plus" class="more-icon" />
          <span class="more-count">{{ remainingPhotosCount }}</span>
          <span class="more-label">еще</span>
        </div>
      </div>
    </div>

    <!-- Empty state for readonly (handled gracefully) -->
    <div v-else class="photos-empty-readonly">
      <span>{{ emptyReadonlyText }}</span>
    </div>

    <!-- Dialog for link adding -->
    <KitDialogWithClose
      v-if="isLinkDialogOpen"
      v-model:visible="isLinkDialogOpen"
      title="Добавить фото по ссылке"
      icon="mdi:link-variant"
      :max-width="440"
    >
      <div class="link-dialog-body">
        <KitInput
          v-model="linkInput"
          label="URL-ссылка на фотографию"
          placeholder="https://images.unsplash.com/..."
          @keydown.enter="handleAddLink"
        />
        <div class="link-dialog-actions">
          <KitBtn
            variant="outlined"
            color="secondary"
            size="sm"
            @click="isLinkDialogOpen = false"
          >
            Отмена
          </KitBtn>
          <KitBtn
            size="sm"
            :disabled="!isValidUrl(linkInput.trim())"
            @click="handleAddLink"
          >
            Добавить
          </KitBtn>
        </div>
      </div>
    </KitDialogWithClose>

    <!-- Fullscreen lightbox image viewer -->
    <KitImageViewer
      v-if="imageViewer.isOpen.value"
      v-model:visible="imageViewer.isOpen.value"
      v-model:current-index="imageViewer.currentIndex.value"
      :images="viewerImages"
      :show-counter="true"
      :enable-thumbnails="photosList.length > 1"
      :close-on-overlay-click="true"
      :show-quality-selector="false"
      :show-info-button="false"
    />
  </div>
</template>

<style scoped lang="scss">
.booking-photos {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  border-radius: var(--r-s);
  transition: all 0.2s ease;

  &.is-drag-over {
    outline: 2px dashed var(--fg-accent-color);
    outline-offset: 2px;
  }
}

.photos-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.photos-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.4px;

  .title-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
  }

  .photos-count-tag {
    font-size: 0.72rem;
    padding: 1px 6px;
    border-radius: var(--r-full);
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-primary-color);
    font-weight: 600;
  }
}

.photos-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hidden-file-input {
  display: none;
}

.photos-dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  background-color: var(--bg-primary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.05);
  }

  .dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }

  .dropzone-icon {
    font-size: 1.8rem;
    color: var(--fg-tertiary-color);
    transition: color 0.2s;

    &.is-spinning {
      animation: spin 1s linear infinite;
      color: var(--fg-accent-color);
    }
  }

  &:hover .dropzone-icon {
    color: var(--fg-accent-color);
  }

  .dropzone-text {
    font-size: 0.825rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  .dropzone-hint {
    font-size: 0.72rem;
    color: var(--fg-tertiary-color);
  }
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  width: 100%;
}

.photo-thumb-wrapper {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--r-s);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  background-color: var(--bg-tertiary-color);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--s-s);
    border-color: var(--fg-accent-color);

    .photo-thumb-overlay {
      opacity: 1;
    }
  }

  .photo-thumb-img {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.photo-thumb-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 60%);
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  justify-content: flex-end;
  padding: 4px;
}

.photo-delete-btn {
  background: rgba(220, 38, 38, 0.85);
  color: #fff;
  border: none;
  border-radius: var(--r-xs);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    background-color 0.2s,
    transform 0.15s;

  &:hover {
    background: rgb(220, 38, 38);
    transform: scale(1.1);
  }
}

.more-photos-thumb {
  position: relative;

  .more-photos-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 600;
    gap: 1px;

    .more-icon {
      font-size: 1.1rem;
    }

    .more-count {
      font-size: 1.1rem;
      line-height: 1;
    }

    .more-label {
      font-size: 0.68rem;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
  }

  &:hover .more-photos-overlay {
    background: rgba(0, 0, 0, 0.75);
  }
}

.photos-empty-readonly {
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
  font-style: italic;
  padding: 4px 0;
}

.link-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.link-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
