<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  src: string
  poster?: string
  alt?: string
}

const props = withDefaults(defineProps<Props>(), {
  poster: '',
  alt: 'Видео',
})

const frameReady = ref(false)
const posterFailed = ref(false)
const videoFailed = ref(false)

const videoUrl = computed(() => resolveApiUrl(props.src))
const posterUrl = computed(() => props.poster && !posterFailed.value ? resolveApiUrl(props.poster) : '')

watch(() => [props.src, props.poster], () => {
  frameReady.value = false
  posterFailed.value = false
  videoFailed.value = false
})

function seekToRandomFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  const duration = video.duration

  if (!Number.isFinite(duration) || duration <= 0)
    return

  const previewTime = duration <= 1
    ? duration / 2
    : duration * (0.1 + Math.random() * 0.8)

  try {
    video.currentTime = previewTime
  }
  catch {
    frameReady.value = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  }
}

function handleLoadedData(event: Event) {
  const video = event.currentTarget as HTMLVideoElement

  if (!video.seeking)
    frameReady.value = true
}
</script>

<template>
  <div class="post-video-thumbnail" :aria-label="alt">
    <img
      v-if="posterUrl"
      :src="posterUrl"
      :alt="alt"
      class="video-poster"
      loading="lazy"
      @error="posterFailed = true"
    >

    <video
      v-if="videoUrl && !posterUrl && !videoFailed"
      :key="videoUrl"
      :src="videoUrl"
      :aria-label="alt"
      class="video-frame"
      :class="{ 'is-ready': frameReady }"
      muted
      playsinline
      preload="metadata"
      @loadedmetadata="seekToRandomFrame"
      @loadeddata="handleLoadedData"
      @seeked="frameReady = true"
      @error="videoFailed = true"
    />

    <div v-if="!posterUrl && (!frameReady || videoFailed)" class="video-thumbnail-placeholder">
      <Icon :icon="videoFailed ? 'mdi:video-off-outline' : 'mdi:video-outline'" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-video-thumbnail {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #242424;
}

.video-poster,
.video-frame,
.video-thumbnail-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.video-poster,
.video-frame {
  object-fit: cover;
}

.video-frame {
  opacity: 0;
  transition: opacity 160ms ease-out;

  &.is-ready {
    opacity: 1;
  }
}

.video-thumbnail-placeholder {
  display: grid;
  place-items: center;
  color: rgb(255 255 255 / 45%);
  font-size: 2rem;
  pointer-events: none;
}
</style>
