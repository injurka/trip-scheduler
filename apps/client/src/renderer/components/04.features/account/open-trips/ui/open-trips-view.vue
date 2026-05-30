<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useOpenTrips } from '../composables/use-open-trips'
import OpenTripCard from './components/open-trip-card.vue'
import OpenTripSkeleton from './components/open-trip-skeleton.vue'

const props = defineProps<{
  userId: string
  isOwnProfile: boolean
}>()

const {
  trips,
  filters,
  availableCities,
  availableTags,
  tagSearchQuery,
  isLoading,
  fetchError,
  hasLoadedOnce,
  fetchTrips,
  fetchAvailableCities,
  searchTags,
} = useOpenTrips(props.userId)

const isFiltersOpen = ref(false)

const statusOptions = [
  { value: 'planned', label: 'Запланировано' },
  { value: 'completed', label: 'Завершено' },
  { value: 'draft', label: 'Черновик' },
]

const selectedCity = computed({
  get: () => filters.value.cities[0] || null,
  set: val => filters.value.cities = val ? [val] : [],
})

const selectedTag = computed({
  get: () => filters.value.tags[0] || null,
  set: val => filters.value.tags = val ? [val] : [],
})

watch(isFiltersOpen, (isOpen) => {
  if (isOpen) {
    fetchAvailableCities()
    searchTags()
  }
})

function clearFilters() {
  filters.value.search = ''
  filters.value.cities = []
  filters.value.tags = []
  filters.value.status = []
}

onMounted(() => {
  fetchTrips()
})
</script>

<template>
  <div class="open-trips-view">
    <div class="toolbar">
      <h2 class="title">
        {{ isOwnProfile ? 'Открытые путешествия' : 'Путешествия' }}
      </h2>
    </div>

    <!-- Основные элементы управления -->
    <div class="hub-controls">
      <KitInput
        v-model="filters.search"
        icon="mdi:magnify"
        placeholder="Поиск по названию..."
        class="search-input"
        aria-label="Поиск по названию"
      />

      <div style="flex-grow: 1" />

      <KitBtn
        icon="mdi:filter-multiple-outline"
        variant="outlined"
        color="secondary"
        class="search-filter-btn"
        :class="{ 'is-active': isFiltersOpen }"
        @click="isFiltersOpen = !isFiltersOpen"
      >
        <span class="desktop-only">Фильтры</span>
      </KitBtn>
    </div>

    <!-- Продвинутые фильтры -->
    <Transition name="slide-fade">
      <div v-if="isFiltersOpen" class="advanced-filters">
        <div class="filter-group">
          <label>Статус</label>
          <KitSelectWithSearch
            v-model="filters.status"
            :items="statusOptions"
            placeholder="Любой статус"
            icon="mdi:list-status"
            multiple
          />
        </div>

        <div class="filter-group">
          <label>Город</label>
          <KitSelectWithSearch
            v-model="selectedCity"
            :items="availableCities"
            placeholder="Все города"
            icon="mdi:map-marker-outline"
            clearable
          />
        </div>

        <div class="filter-group">
          <label>Тег</label>
          <KitSelectWithSearch
            v-model="selectedTag"
            v-model:search-query="tagSearchQuery"
            :items="availableTags"
            placeholder="Все теги"
            icon="mdi:tag-outline"
            clearable
          />
        </div>
      </div>
    </Transition>

    <AsyncStateWrapper
      :loading="isLoading"
      :error="fetchError"
      :data="trips.length > 0 ? trips : null"
      :retry-handler="fetchTrips"
      :transition="hasLoadedOnce ? 'fade' : 'slide-up'"
    >
      <template #loading>
        <div class="trips-grid">
          <OpenTripSkeleton v-for="i in 6" :key="i" />
        </div>
      </template>

      <template #success="{ data }">
        <div class="trips-grid">
          <OpenTripCard
            v-for="trip in data"
            :key="trip.id"
            :trip="trip"
          />
        </div>
      </template>

      <template #empty>
        <div v-if="!filters.search && filters.cities.length === 0 && filters.tags.length === 0" class="empty-state">
          <Icon icon="mdi:compass-off-outline" />
          <p>
            {{ isOwnProfile ? 'У вас пока нет открытых путешествий.' : 'У этого пользователя нет открытых путешествий.' }}
          </p>
        </div>
        <div v-else class="empty-filters-state">
          <Icon icon="mdi:filter-variant-remove" class="empty-icon" />
          <p>Ничего не найдено по выбранным фильтрам.</p>
          <KitBtn variant="subtle" size="sm" @click="clearFilters">
            Сбросить фильтры
          </KitBtn>
        </div>
      </template>
    </AsyncStateWrapper>
  </div>
</template>

<style scoped lang="scss">
.open-trips-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  min-height: 38px;
  gap: 16px;

  .title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.hub-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.search-input {
  max-width: 320px;
  width: 100%;

  :deep(input) {
    border: 1px solid var(--border-secondary-color);
  }
}

.search-filter-btn {
  transition: all 0.2s ease;

  &.is-active {
    border-color: var(--border-accent-color);
    color: var(--fg-accent-color);
    background-color: var(--bg-accent-color);
  }
}

.advanced-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  padding: 16px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);

  @include media-down(sm) {
    padding: 12px;
    gap: 12px;
  }
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    padding-left: 4px;
  }
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.trips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-items: stretch;
}

.empty-state,
.empty-filters-state {
  text-align: center;
  padding: 40px;
  color: var(--fg-tertiary-color);
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  border: 1px dashed var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .iconify,
  .empty-icon {
    font-size: 3rem;
  }

  p {
    margin: 0;
    color: var(--fg-secondary-color);
  }
}

.desktop-only {
  @include media-down(sm) {
    display: none;
  }
}
</style>
