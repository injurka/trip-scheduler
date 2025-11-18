<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { ActivitySectionGallery } from '~/shared/types/models/activity'
import type { TripImage } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { tripImageToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'

interface Props {
  section: ActivitySectionGallery
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])

const store = useModuleStore(['routeGallery', 'ui'])
const { tripImages, isUploadingImage, isFetchingImages } = storeToRefs(store.routeGallery)
const { isViewMode } = storeToRefs(store.ui)

const fileInput = ref<HTMLInputElement | null>(null)
const isImagePickerOpen = ref(false)
const selectedImagesFromTrip = ref<string[]>([])

const imageUrls = computed(() => props.section.imageUrls || [])

const fullImagesData = computed(() => {
  return (props.section.imageUrls || [])
    .map(url => tripImages.value.find(tripImg => tripImg.url === url))
    .filter((img): img is TripImage => !!img)
})

const imageViewer = useImageViewer({
  enableKeyboard: true,
})

const viewerImages = computed<ImageViewerImage[]>(() =>
  fullImagesData.value.map(tripImage => tripImageToViewerImage(tripImage)),
)

function deleteImage(index: number) {
  const updatedUrls = imageUrls.value.filter((_, i) => i !== index)
  emit('updateSection', { ...props.section, imageUrls: updatedUrls })
}

function triggerFileUpload() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0)
    return

  const uploadPromises = Array.from(files).map(file =>
    store.routeGallery.uploadImage(file),
  )

  const newImageRecords = await Promise.all(uploadPromises)

  const newUrls = newImageRecords
    .filter((record): record is NonNullable<TripImage> => record !== null)
    .map(record => record.url)

  if (newUrls.length > 0) {
    const updatedUrls = [...imageUrls.value, ...newUrls]

    emit('updateSection', { ...props.section, imageUrls: updatedUrls })
  }

  target.value = ''
}

function openTripImagePicker() {
  isImagePickerOpen.value = true
}

function onDialogClose() {
  isImagePickerOpen.value = false
  selectedImagesFromTrip.value = []
}

function toggleImageSelection(url: string) {
  const index = selectedImagesFromTrip.value.indexOf(url)
  if (index > -1)
    selectedImagesFromTrip.value.splice(index, 1)
  else
    selectedImagesFromTrip.value.push(url)
}

function confirmImageSelection() {
  const newImages = selectedImagesFromTrip.value.filter(url => !imageUrls.value.includes(url))
  if (newImages.length > 0) {
    const updatedUrls = [...imageUrls.value, ...newImages]
    emit('updateSection', { ...props.section, imageUrls: updatedUrls })
  }
  onDialogClose()
}

function openViewer(index: number) {
  imageViewer.open(viewerImages.value, index)
}

const galleryClass = computed(() => {
  const count = imageUrls.value.length
  if (count <= 3)
    return 'gallery-small'
  if (count <= 6)
    return 'gallery-medium'
  return 'gallery-large'
})

const maxVisibleImages = computed(() => {
  const count = fullImagesData.value.length
  return count <= 4 ? count : 4
})

const remainingImagesCount = computed(() =>
  Math.max(0, fullImagesData.value.length - maxVisibleImages.value),
)

const visibleImages = computed(() =>
  imageUrls.value.slice(0, maxVisibleImages.value),
)
</script>

<template>
  <div class="gallery-section">
    <div v-if="!isViewMode" class="edit-controls">
      <KitBtn
        variant="outlined"
        icon="mdi:upload"
        :loading="isUploadingImage"
        @click="triggerFileUpload"
      >
        {{ isUploadingImage ? 'Загрузка...' : 'Загрузить новое' }}
      </KitBtn>
      <KitBtn
        icon="mdi:image-multiple-outline"
        variant="outlined"
        @click="openTripImagePicker"
      >
        Выбрать из галереи
      </KitBtn>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden-file-input"
      @change="handleFileUpload"
    >

    <div v-if="imageUrls.length > 0" class="gallery-container" :class="galleryClass">
      <div
        v-for="(image, index) in visibleImages"
        :key="`${image}-${index}`"
        class="image-wrapper"
        @click="openViewer(index)"
      >
        <KitImage
          class="image-item"
          :src="image"
          :alt="`Image ${index + 1}`"
          object-fit="cover"
        />

        <div v-if="!isViewMode" class="image-overlay">
          <button
            class="delete-btn"
            title="Удалить изображение"
            @click.stop="deleteImage(index)"
          >
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </div>
      </div>
      <div
        v-if="remainingImagesCount > 0"
        class="more-images-wrapper"
        @click="openViewer(maxVisibleImages)"
      >
        <KitImage
          class="image-item"
          :src="imageUrls[maxVisibleImages]"
          alt="More images"
          object-fit="cover"
        />
        <div class="more-images-overlay">
          <Icon icon="mdi:plus" class="more-icon" />
          <span class="more-text">+{{ remainingImagesCount }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <Icon icon="mdi:image-multiple-outline" class="empty-icon" />
      <p>В этой галерее пока нет изображений.</p>
      <span v-if="!isViewMode" class="empty-hint">
        Загрузите новые или выберите из общей галереи путешествия.
      </span>
      <span v-else class="empty-hint">
        Владелец может добавить их в режиме редактирования.
      </span>
    </div>

    <KitImageViewer
      v-model:visible="imageViewer.isOpen.value"
      v-model:current-index="imageViewer.currentIndex.value"
      :images="viewerImages"
      :show-counter="true"
      :enable-thumbnails="imageUrls.length > 1"
      :close-on-overlay-click="true"
      :show-quality-selector="false"
      :show-info-button="false"
    />

    <KitDialogWithClose
      v-model:visible="isImagePickerOpen"
      title="Галерея путешествия"
      icon="mdi:image-multiple-outline"
      :max-width="900"
      @update:visible="!$event && onDialogClose()"
    >
      <div class="picker-content">
        <div class="picker-body">
          <div v-if="isFetchingImages" class="loading-state">
            <Icon icon="mdi:loading" class="spinner" />
            <p>Загружаем изображения...</p>
          </div>
          <div v-else-if="tripImages.length === 0" class="empty-trip-gallery">
            <Icon icon="mdi:image-off-outline" />
            <p>В галерее путешествия еще нет изображений для маршрута.</p>
          </div>
          <div v-else-if="tripImages.length > 0" class="image-grid">
            <div
              v-for="tripImg in tripImages"
              :key="tripImg.id"
              class="grid-item"
              :class="{
                selected: selectedImagesFromTrip.includes(tripImg.url),
              }"
              @click="toggleImageSelection(tripImg.url)"
            >
              <KitImage :src="tripImg.url" object-fit="cover" />
              <div class="overlay">
                <Icon v-if="selectedImagesFromTrip.includes(tripImg.url)" icon="mdi:check-circle" class="check-icon selected" />
                <Icon v-else icon="mdi:circle-outline" class="check-icon" />
              </div>
            </div>
          </div>
          <div v-else class="empty-trip-gallery">
            <Icon icon="mdi:image-check-outline" />
            <p>Все доступные изображения уже добавлены в эту галерею.</p>
          </div>
        </div>
        <div v-if="!isFetchingImages && tripImages.length > 0" class="picker-footer">
          <KitBtn variant="text" @click="onDialogClose">
            Отмена
          </KitBtn>
          <KitBtn
            :disabled="selectedImagesFromTrip.length === 0"
            @click="confirmImageSelection"
          >
            Добавить выбранные ({{ selectedImagesFromTrip.length }})
          </KitBtn>
        </div>
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.edit-controls {
  display: flex;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 8px;
}

.hidden-file-input {
  display: none;
}

.picker-content {
  display: flex;
  flex-direction: column;
  height: calc(85vh - 100px);
}

.picker-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 4px;
  margin: 0 -4px;

  .loading-state,
  .empty-trip-gallery {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--fg-secondary-color);
    text-align: center;

    .spinner {
      font-size: 3rem;
      animation: spin 1.5s linear infinite;
    }

    p {
      margin-top: 16px;
      font-size: 1.1rem;
    }

    & > .iconify {
      font-size: 4rem;
      opacity: 0.5;
      margin-bottom: 1rem;
    }
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.grid-item {
  position: relative;
  cursor: pointer;
  border-radius: var(--r-s);
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  aspect-ratio: 1 / 1;

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, transparent 50%);
    opacity: 0.8;
    transition: opacity 0.2s ease;
  }

  .check-icon {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 1.8rem;
    color: var(--fg-inverted-color);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
    &.selected {
      color: var(--fg-accent-color);
    }
  }

  &.selected {
    border-color: var(--fg-accent-color);
    transform: scale(1.03);
    .overlay {
      opacity: 1;
    }
  }

  &:hover {
    transform: scale(1.03);
  }
}

.picker-footer {
  padding-top: 16px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.gallery-section {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.gallery-container {
  display: grid;
  gap: 8px;
  height: 250px;
  align-self: center;
  width: 100%;

  &.gallery-small {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  &.gallery-medium {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }

  &.gallery-large {
    grid-template-columns: repeat(5, 1fr);
  }

  @include media-down(sm) {
    &.gallery-large {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 480px) {
    height: 200px;

    &.gallery-medium,
    &.gallery-large {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

.image-wrapper,
.more-images-wrapper {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: var(--r-s);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border-primary-color);
  max-width: 500px;

  &:hover {
    transform: scale(1.02);
    box-shadow: var(--s-m);
    border-color: var(--fg-accent-color);

    .image-overlay {
      opacity: 1;
    }
  }

  .image-item {
    width: 100%;
    height: 100%;
    transition: transform 0.3s ease;
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 60%);
    opacity: 0;
    transition: opacity 0.3s ease;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    padding: 8px;
  }

  .delete-btn {
    background: rgba(220, 38, 38, 0.8);
    color: var(--fg-inverted-color);
    border: none;
    border-radius: var(--r-full);
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.2s;
    backdrop-filter: blur(4px);

    &:hover {
      background: rgba(220, 38, 38, 1);
      transform: scale(1.1);
    }
  }
}

.more-images-wrapper {
  position: relative;

  .more-images-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--fg-inverted-color);
    font-weight: 600;
    backdrop-filter: blur(2px);
    transition: all 0.3s ease;

    .more-icon {
      font-size: 2rem;
      margin-bottom: 4px;
    }

    .more-text {
      font-size: 1.1rem;
    }
  }

  &:hover .more-images-overlay {
    background: rgba(0, 0, 0, 0.7);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 24px;
  color: var(--fg-secondary-color);
  min-height: 180px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-tertiary-color);

  .empty-icon {
    font-size: 3.5rem;
    opacity: 0.4;
    margin-bottom: 16px;
    color: var(--fg-secondary-color);
  }

  p {
    font-weight: 500;
    color: var(--fg-primary-color);
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
}
</style>
