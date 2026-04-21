<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref } from 'vue'
import { useHighlightsFeed } from '../composables/use-highlights-feed'
import FloatingControlBar from './components/floating-control-bar.vue'
import PhotoCard from './components/photo-card.vue'

const { photos, loadMore, hasMore, quality, filterMode, dateRange } = useHighlightsFeed()
const scrollContainer = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)

// Магия скролла: перехват колесика мыши для горизонтальной прокрутки
function onWheel(e: WheelEvent) {
  if (!scrollContainer.value)
    return
  if (e.deltaY !== 0) {
    scrollContainer.value.scrollLeft += e.deltaY
  }
}

// Триггер для бесконечной подгрузки у правого края ленты
useIntersectionObserver(sentinel, ([entry]) => {
  if (entry.isIntersecting && hasMore.value) {
    loadMore()
  }
}, { rootMargin: '0px 1000px 0px 0px' })
</script>

<template>
  <div class="highlights-feed-root">
    <FloatingControlBar
      v-model:quality="quality"
      v-model:filter-mode="filterMode"
      v-model:date-range="dateRange"
      :scroll-container="scrollContainer"
    />

    <div
      ref="scrollContainer"
      class="scroll-container"
      @wheel.prevent="onWheel"
    >
      <div class="feed-content">
        <PhotoCard
          v-for="(photo, index) in photos"
          :key="photo.id"
          :photo="photo"
          :quality="quality"
          :index="index"
        />
        <!-- Sentinel (невидимый якорь для подгрузки) -->
        <div ref="sentinel" class="sentinel" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-feed-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-inverted-color); /* Темный кинематографичный фон */
  background-image: radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
}

.scroll-container {
  width: 100vw;
  height: 100vh;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  scroll-behavior: smooth;

  /* Скрываем стандартный скроллбар */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  @media (max-width: 768px) {
    scroll-snap-type: x mandatory; /* Мягкие остановки на мобильных (свайп) */
  }
}

.feed-content {
  display: flex;
  align-items: center;
  /* Даем пространство в конце, чтобы последняя фотка могла встать по центру экрана */
  padding-right: 50vw;
}

.sentinel {
  width: 10px;
  height: 100%;
  flex-shrink: 0;
  pointer-events: none;
  opacity: 0;
}
</style>
