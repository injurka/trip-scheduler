<script setup lang="ts">
import type { IImageViewerImageMeta, ImageQuality, ImageViewerImage } from '@limiteddissolve/kit-image-viewer'
import type { Component } from 'vue'
import { KitImageViewer as BaseKitImageViewer } from '@limiteddissolve/kit-image-viewer'
import { KitMap } from '~/components/01.kit/kit-map'
import { getOfflineImageUrl } from '~/shared/lib/offline-cache'
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

const offlineUrls = ref<Record<string, string>>({})
let imageGeneration = 0

watch(() => [props.visible, props.images?.length, props.currentIndex] as const, async ([visible, , index]) => {
  if (!visible) {
    imageGeneration++
    releaseOfflineUrls()

    return
  }

  const generation = ++imageGeneration

  if (!props.images || props.images.length === 0)
    return

  const { prioritized, others } = getCandidateUrls(props.images, index, offlineUrls.value)
  const toResolve = [...prioritized, ...others]

  await resolveUrlsBatched(
    toResolve,
    prioritized.length,
    generation,
    (resolved) => {
      offlineUrls.value = { ...offlineUrls.value, ...resolved }
    },
  )
}, { immediate: true })

function extractUrls(item: unknown, target: Set<string>) {
  if (typeof item === 'string' && (/^https?:/.test(item) || /\.(?:png|webp|jpe?g|avif|gif|svg|mp4|webm)(?:[?#]|$)/i.test(item))) {
    target.add(item)
  }
  else if (Array.isArray(item)) {
    for (const v of item)
      extractUrls(v, target)
  }
  else if (item && typeof item === 'object') {
    for (const v of Object.values(item))
      extractUrls(v, target)
  }
}
function getCandidateUrls(images: ImageViewerImage[], index: number, existing: Record<string, string>): { prioritized: string[], others: string[] } {
  const prioritizedIndices = [index, index - 1, index + 1, index - 2, index + 2].filter(i => i >= 0 && i < images.length)
  const prioSet = new Set<string>()

  for (const i of prioritizedIndices)
    extractUrls(images[i], prioSet)

  const prioritized = Array.from(prioSet).filter(u => !existing[u])
  const allSet = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    if (!prioritizedIndices.includes(i))
      extractUrls(images[i], allSet)
  }

  const others = Array.from(allSet).filter(u => !prioSet.has(u) && !existing[u])

  return { prioritized, others }
}
async function resolveUrlsBatched(
  urls: string[],
  prioCount: number,
  generation: number,
  onBatch: (resolved: Record<string, string>) => void,
) {
  let newlyResolved: Record<string, string> = {}
  let batchCount = 0

  for (const url of urls) {
    if (generation !== imageGeneration) {
      for (const b of Object.values(newlyResolved))
        URL.revokeObjectURL(b)

      return
    }

    const blob = await getOfflineImageUrl(url)

    if (!blob)
      continue

    if (generation !== imageGeneration) {
      URL.revokeObjectURL(blob)

      return
    }

    newlyResolved[url] = blob
    batchCount++

    if (batchCount === prioCount || batchCount % 10 === 0) {
      onBatch(newlyResolved)
      newlyResolved = {}
    }
  }

  if (Object.keys(newlyResolved).length > 0)
    onBatch(newlyResolved)
}
function releaseOfflineUrls() {
  for (const url of Object.values(offlineUrls.value))
    URL.revokeObjectURL(url)

  offlineUrls.value = {}
}
function resolveViewerUrl(url: string) {
  return offlineUrls.value[url] || props.resolveUrl(url)
}
async function handleFetchMetadata(image: ImageViewerImage): Promise<IImageViewerImageMeta | null | void> {
  if (props.fetchMetadata) {
    return props.fetchMetadata(image)
  }

  const imageId = (image.meta)?.imageId

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

onBeforeUnmount(() => {
  imageGeneration++
  releaseOfflineUrls()
})
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
    :resolve-url="resolveViewerUrl"
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
