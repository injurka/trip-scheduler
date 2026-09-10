<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onKeyStroke, useIntersectionObserver, useScrollLock } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useMemoriesView } from '../composables/use-memories-view'
import MemoriesFilters from './memories-filters.vue'
import MemoriesGroup from './memories-group.vue'

const store = useModuleStore(['memories', 'plan'])
const { memories, isLoadingMemories } = storeToRefs(store.memories)

const {
  filterDay,
  sortType,
  availableDays,
  sortOptions,
  groupedMemories,
  viewerImages,
  allFilteredMemories,
  filterRating,
  hasMore,
  loadMore,
} = useMemoriesView(memories)

const imageViewer = useImageViewer()
const isFullscreen = ref(false)

const isBodyScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null)
const isHtmlScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.documentElement : null)

watch(isFullscreen, (val) => {
  isBodyScrollLocked.value = val
  isHtmlScrollLocked.value = val
})

onKeyStroke('Escape', () => {
  if (!imageViewer.isOpen.value && isFullscreen.value) {
    isFullscreen.value = false
  }
})

onBeforeUnmount(() => {
  isBodyScrollLocked.value = false
  isHtmlScrollLocked.value = false
})

function openViewer(memoryId: string) {
  const index = allFilteredMemories.value.findIndex(m => m.id === memoryId)
  if (index !== -1) {
    imageViewer.open(viewerImages.value, index)
  }
}

const loadMoreTrigger = ref<HTMLElement | null>(null)

useIntersectionObserver(
  loadMoreTrigger,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasMore.value) {
      loadMore()
    }
  },
  {
    rootMargin: '200px',
  },
)

onMounted(() => {
  if (store.plan.currentTripId) {
    store.memories.fetchMemories(store.plan.currentTripId)
  }
})
</script>

<template>
  <div class="memories-section" :class="{ 'is-fullscreen': isFullscreen }">
    <MemoriesFilters
      v-model:filter-day="filterDay"
      v-model:filter-rating="filterRating"
      v-model:sort-order="sortType"
      v-model:is-fullscreen="isFullscreen"
      :available-days="availableDays"
      :sort-options="sortOptions"
    />

    <div v-if="isLoadingMemories && memories.length === 0" class="skeleton-grid">
      <div v-for="i in 12" :key="i" class="skeleton-item">
        <KitSkeleton width="100%" height="100%" />
      </div>
    </div>

    <div v-else-if="allFilteredMemories.length === 0" class="empty-state">
      <Icon icon="mdi:image-filter-hdr" class="empty-icon" />
      <p>Фотографий не найдено</p>
      <span v-if="memories.length === 0" class="sub-text">Добавляйте фото в ленту дня или через меню загрузки.</span>
    </div>

    <div v-else class="gallery-content">
      <MemoriesGroup
        v-for="group in groupedMemories"
        :key="group.date"
        :group="group"
        @click-image="openViewer"
      />

      <div v-if="hasMore" ref="loadMoreTrigger" class="load-trigger">
        <span class="loading-text">
          <Icon icon="mdi:loading" class="spin" />
          Загрузка фото...
        </span>
      </div>
    </div>

    <KitImageViewer
      v-if="imageViewer.isOpen.value"
      v-model:visible="imageViewer.isOpen.value"
      v-model:current-index="imageViewer.currentIndex.value"
      :images="viewerImages"
      :show-counter="true"
      :enable-thumbnails="true"
    />
  </div>
</template>

<style scoped lang="scss">
.memories-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 400px;
  z-index: 6;

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    top: var(--safe-area-inset-top, 0px);
    z-index: 990;
    background-color: var(--bg-primary-color);
    padding: 16px 24px;
    overflow-y: auto;
    height: 100vh;
    height: 100dvh;

    @media (max-width: 768px) {
      padding: 12px 12px calc(12px + var(--safe-area-inset-bottom, 0px));
    }

    :deep(.filters-header) {
      position: sticky;
      top: 0;
      z-index: 20;
      box-shadow: var(--s-m);
    }
  }
}

.gallery-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.load-trigger {
  min-height: 60px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: 20px;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
}

.spin {
  animation: spin 1s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  color: var(--fg-tertiary-color);
  text-align: center;

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  p {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    margin: 0 0 4px 0;
  }

  .sub-text {
    font-size: 0.9rem;
  }
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  width: 100%;
  margin-top: 48px;
}

.skeleton-item {
  aspect-ratio: 1;
  border-radius: var(--r-m);
  overflow: hidden;
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
