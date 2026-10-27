<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ src: string, label: string }>()
const emit = defineEmits<{
  ready: [video: HTMLVideoElement | null]
  loadedmetadata: [event: Event]
  error: [event: Event]
}>()
const video = ref<HTMLVideoElement | null>(null)
const player = ref<HTMLElement | null>(null)
const playing = ref(false)
const waiting = ref(false)
const time = ref(0)
const duration = ref(0)
const volume = ref(1)
const muted = ref(false)
const rate = ref(1)
const playbackError = ref('')
const progress = computed(() => duration.value > 0 ? time.value / duration.value * 100 : 0)

watch(video, value => emit('ready', value), { flush: 'post' })
onBeforeUnmount(() => {
  video.value?.pause()
  emit('ready', null)
})

function sync() {
  const media = video.value
  if (!media)
    return
  playing.value = !media.paused && !media.ended
  time.value = media.currentTime
  duration.value = Number.isFinite(media.duration) ? media.duration : 0
  volume.value = media.volume
  muted.value = media.muted
  rate.value = media.playbackRate
}

async function togglePlay() {
  const media = video.value
  if (!media)
    return
  playbackError.value = ''
  if (media.paused) {
    try {
      await media.play()
    }
    catch {
      playbackError.value = 'Не удалось начать воспроизведение. Попробуйте ещё раз.'
    }
  }
  else {
    media.pause()
  }
}

function seek(event: Event) {
  if (video.value && duration.value > 0)
    video.value.currentTime = Number((event.target as HTMLInputElement).value)
}

function setVolume(event: Event) {
  if (!video.value)
    return
  video.value.volume = Number((event.target as HTMLInputElement).value)
  video.value.muted = false
  sync()
}

function toggleMute() {
  if (video.value) {
    video.value.muted = !video.value.muted
    sync()
  }
}

function setRate(event: Event) {
  if (video.value) {
    video.value.playbackRate = Number((event.target as HTMLSelectElement).value)
    sync()
  }
}

async function fullscreen() {
  try {
    if (document.fullscreenElement)
      await document.exitFullscreen()
    else if (player.value?.requestFullscreen)
      await player.value.requestFullscreen()
    else
      (video.value as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.()
  }
  catch { playbackError.value = 'Полноэкранный режим недоступен.' }
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
</script>

<template>
  <div ref="player" class="video-player" @click.stop @wheel.stop @touchstart.stop @touchmove.stop @touchend.stop>
    <video
      ref="video"
      :src="props.src"
      :aria-label="label"
      class="viewer-image viewer-video"
      playsinline
      preload="metadata"
      @click="togglePlay"
      @dblclick="fullscreen"
      @loadedmetadata="event => { sync(); emit('loadedmetadata', event) }"
      @durationchange="sync"
      @timeupdate="sync"
      @play="sync"
      @pause="sync"
      @ended="sync"
      @volumechange="sync"
      @ratechange="sync"
      @waiting="waiting = true"
      @playing="waiting = false"
      @canplay="waiting = false"
      @error="event => { waiting = false; emit('error', event) }"
    />
    <button v-if="!playing" class="center-play" aria-label="Воспроизвести видео" @click="togglePlay">
      <Icon icon="mdi:play" />
    </button>
    <div v-if="waiting && playing" class="buffering" role="status" aria-label="Буферизация">
      <Icon icon="mdi:loading" />
    </div>
    <div class="video-controls">
      <div class="timeline">
        <progress :value="progress" max="100" aria-hidden="true" />
        <input aria-label="Позиция воспроизведения" type="range" min="0" :max="duration || 0" step="0.1" :value="time" :disabled="!duration" @input="seek">
      </div>
      <div class="controls-row">
        <button :aria-label="playing ? 'Пауза' : 'Воспроизвести'" :title="playing ? 'Пауза' : 'Воспроизвести'" @click="togglePlay">
          <Icon :icon="playing ? 'mdi:pause' : 'mdi:play'" />
        </button>
        <span class="video-time">{{ formatTime(time) }} <span>/ {{ formatTime(duration) }}</span></span>
        <div class="controls-spacer" />
        <button :aria-label="muted ? 'Включить звук' : 'Выключить звук'" :aria-pressed="muted" @click="toggleMute">
          <Icon :icon="muted || !volume ? 'mdi:volume-off' : 'mdi:volume-high'" />
        </button>
        <input class="volume" aria-label="Громкость" type="range" min="0" max="1" step="0.05" :value="muted ? 0 : volume" @input="setVolume">
        <select aria-label="Скорость воспроизведения" :value="rate" @change="setRate">
          <option v-for="speed in [0.5, 0.75, 1, 1.25, 1.5, 2]" :key="speed" :value="speed">
            {{ speed }}×
          </option>
        </select>
        <button aria-label="Полный экран" title="Полный экран" @click="fullscreen">
          <Icon icon="mdi:fullscreen" />
        </button>
      </div>
      <span v-if="playbackError" class="playback-error" role="status">{{ playbackError }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  color: #fff;
  line-height: normal;
  isolation: isolate;
}
.viewer-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}
button,
select {
  color: inherit;
  cursor: pointer;
  border: 0;
}
button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px;
  background: transparent;
  font-size: 24px;
  flex-shrink: 0;
  transition:
    background 0.15s,
    transform 0.15s;
}
button:hover {
  background: rgba(255, 255, 255, 0.14);
}
button:active {
  transform: scale(0.94);
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid #ffb07c;
  outline-offset: 3px;
}
.center-play {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  font-size: 42px;
}
.center-play:active {
  transform: translate(-50%, -50%) scale(0.94);
}
.buffering {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 36px;
  animation: spin 1s linear infinite;
}
.video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 36px 20px 14px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}
.timeline {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}
.timeline progress {
  width: 100%;
  height: 4px;
  appearance: none;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.25);
}
.timeline progress::-webkit-progress-bar {
  background: rgba(255, 255, 255, 0.25);
}
.timeline progress::-webkit-progress-value {
  background: #ffae78;
}
.timeline progress::-moz-progress-bar {
  background: #ffae78;
}
.timeline input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.timeline input::-webkit-slider-runnable-track {
  background: transparent;
  height: 4px;
}
.timeline input::-moz-range-track {
  background: transparent;
  height: 4px;
}
.timeline input::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  margin-top: -4px;
  border-radius: 50%;
  background: #ffae78;
  box-shadow: 0 0 0 4px rgba(255, 174, 120, 0.15);
}
.timeline input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: #ffae78;
}
.timeline:focus-within {
  outline: 2px solid #ffb07c;
  border-radius: 6px;
}
.controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.controls-spacer {
  flex: 1;
}
.video-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.video-time span {
  color: #aeb1b8;
}
.volume {
  width: 72px;
  accent-color: #ffae78;
}
select {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
}
option {
  background: #181a20;
}
.playback-error {
  display: block;
  font-size: 12px;
  color: #ffbeab;
  padding: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 599px) {
  .video-controls {
    padding: 30px 10px 8px;
  }
  .controls-row {
    gap: 4px;
  }
  .volume {
    display: none;
  }
  button {
    width: 36px;
    height: 40px;
  }
  .center-play {
    width: 64px;
    height: 64px;
  }
  .video-time {
    font-size: 12px;
  }
}
</style>
