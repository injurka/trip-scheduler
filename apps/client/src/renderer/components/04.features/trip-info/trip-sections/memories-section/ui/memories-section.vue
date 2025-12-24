<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useMemoriesView } from '../composables/use-memories-view'
import MemoriesFilters from './memories-filters.vue'
import MemoriesGroup from './memories-group.vue'

const store = useModuleStore(['memories', 'plan'])
const { memories } = storeToRefs(store.memories)

const {
  filterDay,
  sortType,
  availableDays,
  sortOptions,
  groupedMemories,
  viewerImages,
  allFilteredMemories,
  filterRating,
  renderLimit,
  loadMore,
} = useMemoriesView(memories)

const imageViewer = useImageViewer()

function openViewer(memoryId: string) {
  const index = allFilteredMemories.value.findIndex(m => m.id === memoryId)
  if (index !== -1) {
    imageViewer.open(viewerImages.value, index)
  }
}

const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (store.plan.currentTripId) {
    store.memories.fetchMemories(store.plan.currentTripId)
  }

  observer = new IntersectionObserver((entries) => {
    const target = entries[0]
    // Проверяем не только видимость, но и есть ли что загружать
    if (target.isIntersecting && renderLimit.value < allFilteredMemories.value.length) {
      loadMore()
    }
  }, {
    rootMargin: '200px',
    threshold: 0.1,
  })

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})

onUnmounted(() => {
  if (observer)
    observer.disconnect()
})
</script>

<template>
  <div class="memories-section">
    <MemoriesFilters
      v-model:filter-day="filterDay"
      v-model:filter-rating="filterRating"
      v-model:sort-order="sortType"
      :available-days="availableDays"
      :sort-options="sortOptions"
    />

    <div v-if="allFilteredMemories.length === 0" class="empty-state">
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

      <div ref="loadMoreTrigger" class="load-trigger">
        <span v-if="renderLimit < allFilteredMemories.length" class="loading-text">
          Загрузка фото...
        </span>
      </div>
    </div>

    <KitImageViewer
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
}

.gallery-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.load-trigger {
  min-height: 40px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
  padding-bottom: 20px;
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
</style>
