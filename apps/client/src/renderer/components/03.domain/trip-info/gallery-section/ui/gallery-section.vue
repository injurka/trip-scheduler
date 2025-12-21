<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { ActivitySectionGallery } from '~/shared/types/models/activity'
import type { TripImage } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { tripImageToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'
import { ETripGalleryKeys } from '~/components/05.modules/trip-info/store/trip-info-route-gallery.store'
import { useRequestError } from '~/plugins/request'
import GalleryPicker from './gallery-picker.vue'

interface Props {
  section: ActivitySectionGallery
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])
const route = useRoute()

const store = useModuleStore(['routeGallery', 'ui'])
const { tripImages, isUploadingImage, isFetchingImages } = storeToRefs(store.routeGallery)
const { isViewMode } = storeToRefs(store.ui)

const fileInput = ref<HTMLInputElement | null>(null)
const isImagePickerOpen = ref(false)
const fetchError = useRequestError(ETripGalleryKeys.FETCH_IMAGES)

const imageUrls = computed(() => props.section.imageUrls || [])
const tripId = computed(() => route.params.id as string)

// --- Data Loading ---
function loadImages() {
  if (tripId.value) {
    store.routeGallery.setTripId(tripId.value)
    store.routeGallery.fetchTripImages()
  }
}

onMounted(() => {
  loadImages()
})

// --- Computed Data ---
const fullImagesData = computed(() => {
  return imageUrls.value
    .map(url => tripImages.value.find(tripImg => tripImg.url === url))
    .filter((img): img is TripImage => !!img)
})

// Для AsyncStateWrapper
const displayData = computed(() => fullImagesData.value.length > 0 ? fullImagesData.value : null)

const viewerImages = computed<ImageViewerImage[]>(() =>
  fullImagesData.value.map(tripImage => tripImageToViewerImage(tripImage)),
)

const imageViewer = useImageViewer({
  enableKeyboard: true,
})

// CSS классы для сетки в зависимости от кол-ва изображений
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

// --- Actions ---
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

// Обновление секции после выбора в пикере
function handlePickerConfirm(selectedUrls: string[]) {
  emit('updateSection', { ...props.section, imageUrls: selectedUrls })
}

function openViewer(index: number) {
  imageViewer.open(viewerImages.value, index)
}
</script>

<template>
  <div class="gallery-section">
    <div v-if="!isViewMode" class="edit-controls">
      <KitBtn
        variant="subtle"
        icon="mdi:upload"
        :loading="isUploadingImage"
        @click="triggerFileUpload"
      >
        {{ isUploadingImage ? 'Загрузка...' : 'Загрузить новое' }}
      </KitBtn>
      <KitBtn
        icon="mdi:image-multiple-outline"
        variant="tonal"
        @click="isImagePickerOpen = true"
      >
        Выбрать из галереи
      </KitBtn>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
      multiple
      class="hidden-file-input"
      @change="handleFileUpload"
    >

    <AsyncStateWrapper
      :loading="isFetchingImages"
      :error="fetchError"
      :data="displayData"
      :retry-handler="loadImages"
      class="gallery-state-wrapper"
    >
      <template #loading>
        <div class="gallery-container gallery-skeleton" :class="galleryClass">
          <div v-for="i in 3" :key="i" class="skeleton-wrapper">
            <KitSkeleton width="100%" height="100%" border-radius="8px" />
          </div>
        </div>
      </template>

      <template #success>
        <div class="gallery-container" :class="galleryClass">
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
      </template>

      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:image-multiple-outline" class="empty-icon" />
          <p>В этой галерее пока нет изображений.</p>
          <span v-if="!isViewMode" class="empty-hint">
            Загрузите новые или выберите из общей галереи путешествия.
          </span>
          <span v-else class="empty-hint">
            Владелец может добавить их в режиме редактирования.
          </span>
        </div>
      </template>
    </AsyncStateWrapper>

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

    <!-- Использование нового компонента -->
    <GalleryPicker
      v-model:visible="isImagePickerOpen"
      :initial-selected-urls="imageUrls"
      @confirm="handlePickerConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.edit-controls {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 8px;
}

.hidden-file-input {
  display: none;
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
    &.gallery-large,
    &.gallery-skeleton {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

.skeleton-wrapper {
  width: 100%;
  height: 100%;
  border-radius: var(--r-s);
  overflow: hidden;
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
