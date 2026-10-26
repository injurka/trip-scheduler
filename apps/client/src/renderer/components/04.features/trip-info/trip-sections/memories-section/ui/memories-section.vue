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
const { days } = storeToRefs(store.plan)
const route = useRoute()
const router = useRouter()

const {
  gridSize,
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
} = useMemoriesView(memories, days)

const imageViewer = useImageViewer()
const isFullscreen = ref(false)

const isBodyScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null)
const isHtmlScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.documentElement : null)

watch(isFullscreen, (val) => {
  isBodyScrollLocked.value = val
  isHtmlScrollLocked.value = val
})

onKeyStroke('Escape', (event) => {
  if (!event.defaultPrevented && !imageViewer.isOpen.value && isFullscreen.value) {
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

function getMatchedDay(date: string) {
  if (!date || date === 'no-date')
    return undefined
  return days.value.find(day => day.date?.slice(0, 10) === date)
}

function handleToggleFilterDay(date: string) {
  filterDay.value = filterDay.value === date ? 'all' : date
}

function handleGoToDayPlan(dayId: string) {
  isFullscreen.value = false
  const query = { ...route.query }
  delete query.section
  query.day = dayId
  router.push({ query })
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
  <Teleport to="body" :disabled="!isFullscreen">
    <div class="memories-section" :class="{ 'is-fullscreen': isFullscreen }">
      <MemoriesFilters
        v-model:filter-day="filterDay"
        v-model:filter-rating="filterRating"
        v-model:sort-order="sortType"
        v-model:is-fullscreen="isFullscreen"
        v-model:grid-size="gridSize"
        :available-days="availableDays"
        :sort-options="sortOptions"
      />

      <div
        v-if="isLoadingMemories && memories.length === 0"
        class="skeleton-grid"
        :class="`is-size-${gridSize}`"
      >
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
          :matched-day="getMatchedDay(group.date)"
          :current-filter-day="filterDay"
          :grid-size="gridSize"
          @click-image="openViewer"
          @play-group="openViewer"
          @toggle-filter-day="handleToggleFilterDay"
          @go-to-day-plan="handleGoToDayPlan"
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
  </Teleport>
</template>

<style scoped lang="scss">
.memories-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 400px;
  --memories-group-header-top: calc(var(--header-height, 60px) + 12px);

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    top: var(--safe-area-inset-top, 0px);
    z-index: 995;
    background-color: var(--bg-primary-color);
    padding: 16px 24px;
    overflow-y: auto;
    height: 100vh;
    height: 100dvh;
    --memories-group-header-top: 12px;

    @media (max-width: 768px) {
      padding: 12px 12px calc(12px + var(--safe-area-inset-bottom, 0px));
      --memories-group-header-top: 8px;
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
  grid-template-columns: repeat(auto-fill, minmax(var(--cell-size, 190px), 1fr));
  gap: var(--grid-gap, 8px);
  width: 100%;
  margin-top: 48px;

  &.is-size-sm {
    --cell-size: 130px;
    --grid-gap: 6px;
  }

  &.is-size-md {
    --cell-size: 190px;
    --grid-gap: 8px;
  }

  &.is-size-lg {
    --cell-size: 290px;
    --grid-gap: 12px;
  }
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
