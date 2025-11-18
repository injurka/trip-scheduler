<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, reactive, ref } from 'vue'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import MemoryProcessingCard from './processing-card.vue'

// --- UI State ---
const isCollapsed = ref(false)
const isFullScreen = ref(false)
const BATCH_SIZE = 9
const visibleCount = ref(BATCH_SIZE)

const queueClasses = computed(() => ({
  'processing-queue': true,
  'is-fullscreen': isFullScreen.value,
}))

const { memories: memoriesStore } = useModuleStore(['memories'])
const { memoriesToProcess } = storeToRefs(memoriesStore)

/**
 * Реактивное состояние для фильтров отображения фотографий в очереди.
 */
const filters = reactive({
  showWithDate: true, // Показать фото, у которых есть дата, но она не совпадает с текущим днем
  showWithoutDate: true, // Показать фото, у которых дата отсутствует вовсе
})

/**
 * Отфильтрованный список воспоминаний для отображения на основе выбранных фильтров.
 */
const filteredMemories = computed(() => {
  if (!memoriesToProcess.value)
    return []

  return memoriesToProcess.value.filter((memory) => {
    const hasTimestamp = !!memory.image?.takenAt

    if (hasTimestamp && filters.showWithDate)
      return true

    if (!hasTimestamp && filters.showWithoutDate)
      return true

    return false
  })
})

/**
 * Отфильтрованный и постранично разделенный список воспоминаний для отображения.
 */
const paginatedMemories = computed(() => {
  return filteredMemories.value.slice(0, visibleCount.value)
})

/**
 * Увеличивает количество видимых фотографий.
 */
function showMore() {
  visibleCount.value += BATCH_SIZE
}
</script>

<template>
  <div :class="queueClasses">
    <div class="queue-header">
      <div class="header-content">
        <h4><Icon icon="mdi:image-sync-outline" /> Фотографии для обработки</h4>
        <p>Здесь находятся фото без даты или снятые в другой день. Назначьте им время и комментарий, чтобы они появились в ленте воспоминаний.</p>
      </div>
      <div class="header-actions">
        <button class="action-btn" :title="isFullScreen ? 'Свернуть из полноэкранного режима' : 'На весь экран'" @click="isFullScreen = !isFullScreen">
          <Icon :icon="isFullScreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
        </button>
        <button class="action-btn" :title="isCollapsed ? 'Развернуть' : 'Свернуть'" @click="isCollapsed = !isCollapsed">
          <Icon :icon="isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
      </div>
    </div>
    <div v-show="!isCollapsed" class="queue-content">
      <div class="queue-filters">
        <KitCheckbox v-model="filters.showWithoutDate">
          Без даты
        </KitCheckbox>
        <KitCheckbox v-model="filters.showWithDate">
          Снятые в другой день
        </KitCheckbox>
      </div>
      <div v-if="paginatedMemories.length > 0" class="queue-grid">
        <MemoryProcessingCard v-for="memory in paginatedMemories" :key="memory.id" :memory="memory" />
      </div>
      <div v-else class="empty-queue">
        <Icon icon="mdi:check-circle-outline" class="empty-icon" />
        <p>Отлично! Все фотографии отсортированы.</p>
      </div>
      <div v-if="paginatedMemories.length < filteredMemories.length" class="show-more-container">
        <button class="show-more-button" @click="showMore">
          Показать больше
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.processing-queue {
  padding: 24px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  margin-bottom: 32px;
  transition: all 0.3s ease-in-out;

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
    overflow-y: auto;
    border-radius: 0;
    padding: 24px 48px;
  }
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}

.header-content {
  flex-grow: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
  .action-btn {
    background: none;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    color: var(--fg-secondary-color);
    cursor: pointer;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    &:hover {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }
}

.queue-filters {
  display: flex;
  gap: 16px;
  margin: 20px 0;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.empty-queue {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: var(--fg-secondary-color);

  .empty-icon {
    font-size: 3rem;
    color: var(--fg-success-color);
    margin-bottom: 12px;
  }

  p {
    font-size: 1rem;
    font-weight: 500;
  }
}

.show-more-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.show-more-button {
  padding: 12px 24px;
  border-radius: var(--r-s);
  cursor: pointer;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);
  font-weight: 500;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: var(--bg-hover-color);
  }
}
</style>
