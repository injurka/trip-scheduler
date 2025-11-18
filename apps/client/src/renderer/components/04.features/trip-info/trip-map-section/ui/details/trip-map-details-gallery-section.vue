<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { ActivitySectionGallery } from '~/shared/types/models/activity'
import type { TripImage } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { tripImageToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'

interface Props {
  section: ActivitySectionGallery
}

const props = defineProps<Props>()

const store = useModuleStore(['routeGallery'])
const { tripImages } = storeToRefs(store.routeGallery)

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

function openViewer(index: number) {
  imageViewer.open(viewerImages.value, index)
}

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
    <div v-if="imageUrls.length > 0" class="gallery-container">
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
  </div>
</template>

<style scoped lang="scss">
.gallery-section {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
}

.gallery-container {
  display: grid;
  gap: 8px;
  height: 250px;
  align-self: center;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));

  @media (max-width: 480px) {
    height: 200px;
    grid-template-columns: repeat(2, 1fr);
  }
}

.image-wrapper,
.more-images-wrapper {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: var(--r-s);
  border: 1px solid var(--border-primary-color);
  max-width: 500px;
}

.image-item {
  width: 100%;
  height: 100%;
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
  }

  .more-icon {
    font-size: 2rem;
    margin-bottom: 4px;
  }

  .more-text {
    font-size: 1.1rem;
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
  }

  p {
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}
</style>
