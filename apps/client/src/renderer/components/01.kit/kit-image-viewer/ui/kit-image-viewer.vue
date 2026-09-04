<script setup lang="ts">
import type { IImageViewerImageMeta, ImageQuality, ImageViewerImage } from '@injurka/kit-image-viewer'
import type { Component } from 'vue'
import { KitImageViewer as BaseKitImageViewer } from '@injurka/kit-image-viewer'
import { KitMap } from '~/components/01.kit/kit-map'
import { resolveApiUrl } from '~/shared/lib/url'
import { trpc } from '~/shared/services/trpc/trpc.service'

interface Props {
  visible: boolean
  images: ImageViewerImage[]
  currentIndex?: number
  quality?: ImageQuality
  showCounter?: boolean
  enableThumbnails?: boolean
  closeOnOverlayClick?: boolean
  enableKeyboard?: boolean
  maxZoom?: number
  minZoom?: number
  zoomStep?: number
  enableTouch?: boolean
  animationDuration?: number
  showQualitySelector?: boolean
  showInfoButton?: boolean
  hasNextPage?: boolean
  hasPrevPage?: boolean
  isFetching?: boolean
  resolveUrl?: (url: string) => string
  fetchMetadata?: (image: ImageViewerImage) => Promise<IImageViewerImageMeta | null | void>
  mapComponent?: Component
  qualityLabels?: Record<string, string>
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:currentIndex', value: number): void
  (e: 'update:quality', value: ImageQuality): void
  (e: 'close'): void
  (e: 'imageLoad', image: ImageViewerImage): void
  (e: 'imageError', error: Event): void
  (e: 'nextPage'): void
  (e: 'prevPage'): void
  (e: 'fetchMetadata', image: ImageViewerImage): void
}

const props = withDefaults(defineProps<Props>(), {
  currentIndex: 0,
  showCounter: true,
  enableThumbnails: false,
  closeOnOverlayClick: true,
  enableKeyboard: true,
  maxZoom: 4,
  minZoom: 1,
  zoomStep: 0.5,
  enableTouch: true,
  animationDuration: 300,
  showQualitySelector: true,
  showInfoButton: true,
  resolveUrl: (url: string) => resolveApiUrl(url),
  mapComponent: () => KitMap,
})

const emit = defineEmits<Emits>()

async function handleFetchMetadata(image: ImageViewerImage): Promise<IImageViewerImageMeta | null | void> {
  if (props.fetchMetadata) {
    return props.fetchMetadata(image)
  }

  const imageId = (image.meta as any)?.imageId
  if (imageId) {
    try {
      return await trpc.image.getMetadata.query({ id: imageId })
    }
    catch (e) {
      console.error('[KitImageViewer] Failed to fetch image metadata:', e)
      return null
    }
  }

  return null
}
</script>

<template>
  <BaseKitImageViewer
    :visible="visible"
    :images="images"
    :current-index="currentIndex"
    :quality="quality"
    :show-counter="showCounter"
    :enable-thumbnails="enableThumbnails"
    :close-on-overlay-click="closeOnOverlayClick"
    :enable-keyboard="enableKeyboard"
    :max-zoom="maxZoom"
    :min-zoom="minZoom"
    :zoom-step="zoomStep"
    :enable-touch="enableTouch"
    :animation-duration="animationDuration"
    :show-quality-selector="showQualitySelector"
    :show-info-button="showInfoButton"
    :has-next-page="hasNextPage"
    :has-prev-page="hasPrevPage"
    :is-fetching="isFetching"
    :resolve-url="resolveUrl"
    :fetch-metadata="handleFetchMetadata"
    :map-component="mapComponent"
    :quality-labels="qualityLabels"
    @update:visible="emit('update:visible', $event)"
    @update:current-index="emit('update:currentIndex', $event)"
    @update:quality="emit('update:quality', $event)"
    @close="emit('close')"
    @image-load="emit('imageLoad', $event)"
    @image-error="emit('imageError', $event)"
    @next-page="emit('nextPage')"
    @prev-page="emit('prevPage')"
    @fetch-metadata="emit('fetchMetadata', $event)"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps || {}" />
    </template>
  </BaseKitImageViewer>
</template>
