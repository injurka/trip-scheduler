<script setup lang="ts">
import type { TDisplayMode, TripsHubTab } from '../composables/use-trips-hub'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { TripsHubKey, useTripsHub } from '../composables/use-trips-hub'
import TripsFilters from './controls/trips-filters.vue'
import TripList from './list-trip/list.vue'
import CreateTripFlow from './new-trip/create-trip-flow.vue'

const emit = defineEmits<{
  (e: 'update:hasError', value: boolean): void
}>()

const tripsHub = useTripsHub()
const { mdAndUp, smAndDown } = useDisplay()

const currentTab = computed({
  get: () => tripsHub.activeTab.value,
  set: (tab: TripsHubTab) => tripsHub.setActiveTab(tab),
})

const tabItems: ViewSwitcherItem<TripsHubTab>[] = [
  { id: 'my', label: 'Мои путешествия', icon: 'mdi:account-heart-outline' },
  { id: 'public', label: 'Общие путешествия', icon: 'mdi:earth' },
]

const tabLabel = computed(() => tabItems.find(f => f.id === currentTab.value))

const displayModeItems: ViewSwitcherItem<TDisplayMode>[] = [
  { id: 'column', icon: 'mdi:view-grid-outline', label: '' },
  { id: 'row', icon: 'mdi:view-list-outline', label: '' },
]

const currentDisplayMode = computed({
  get: () => tripsHub.displayMode.value,
  set: (mode: TDisplayMode) => tripsHub.setDisplayMode(mode),
})

const statusOptions = [
  { value: 'planned', label: 'Запланировано' },
  { value: 'completed', label: 'Завершено' },
  { value: 'draft', label: 'Черновик' },
]

const selectedCity = computed({
  get: () => tripsHub.filters.value.cities[0] || null,
  set: (val) => {
    tripsHub.filters.value.cities = val ? [val] : []
  },
})

const selectedTag = computed({
  get: () => tripsHub.filters.value.tags[0] || null,
  set: (val) => {
    tripsHub.filters.value.tags = val ? [val] : []
  },
})

watch(
  () => tripsHub.isFiltersOpen.value,
  (isOpen) => {
    if (isOpen) {
      tripsHub.fetchAvailableCities()
      tripsHub.searchTags()
    }
  },
)

watch(
  () => tripsHub.fetchError.value,
  (newError) => {
    emit('update:hasError', !!newError)
  },
)

onMounted(() => {
  tripsHub.fetchTrips()
  tripsHub.setActiveTab('my')
})

provide(TripsHubKey, tripsHub)
</script>

<template>
  <div
    class="trips-hub-container"
    :class="{ 'has-error': !!tripsHub.fetchError.value }"
  >
    <div class="hub-header">
      <div class="header-info">
        <h1>Путешествия</h1>
        <p>Ваши планы и приключения в одном месте.</p>
      </div>
      <KitBtn
        icon="mdi:plus"
        @click="tripsHub.openCreateModal"
      >
        <template v-if="mdAndUp">
          Создать
        </template>
      </KitBtn>
    </div>

    <div class="hub-controls-wrapper">
      <div class="hub-controls">
        <KitViewSwitcher
          v-model="currentTab"
          :items="tabItems"
        />
        <div class="spacer" />
        <TripsFilters
          v-model:filters="tripsHub.filters.value"
          v-model:is-open="tripsHub.isFiltersOpen.value"
        />
        <KitViewSwitcher
          v-if="mdAndUp"
          v-model="currentDisplayMode"
          :items="displayModeItems"
        />
      </div>

      <Transition name="slide-fade">
        <div v-if="tripsHub.isFiltersOpen.value">
          <KitDivider class="advanced-filters-divider">
            Фильтры
          </KitDivider>

          <div class="advanced-filters">
            <div class="filter-group">
              <label>Статус</label>
              <KitSelectWithSearch
                v-model="tripsHub.filters.value.status"
                :items="statusOptions"
                placeholder="Выберите статусы..."
                icon="mdi:list-status"
                multiple
              />
            </div>

            <div class="filter-group">
              <label>Город</label>
              <KitSelectWithSearch
                v-model="selectedCity"
                :items="tripsHub.availableCities.value"
                placeholder="Начните вводить город..."
                icon="mdi:map-marker-outline"
              />
            </div>

            <div class="filter-group">
              <label>Тег</label>
              <KitSelectWithSearch
                v-model="selectedTag"
                v-model:search-query="tripsHub.tagSearchQuery.value"
                :items="tripsHub.availableTags.value"
                placeholder="Начните вводить тег..."
                icon="mdi:tag-outline"
              />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Mobile Tab Info Block -->
      <div v-if="smAndDown && currentTab" class="mobile-tab-info">
        <KitDivider>
          <span class="mobile-tab-label">{{ tabLabel?.label }}</span>
        </KitDivider>
      </div>
    </div>

    <div class="hub-content" :class="`display-mode--${tripsHub.displayMode.value}`">
      <TripList
        :is-loading="tripsHub.isLoading.value"
        :error="tripsHub.fetchError.value"
        :trips="tripsHub.currentTrips.value"
        :has-loaded-once="tripsHub.hasLoadedOnce.value"
        @retry="tripsHub.fetchTrips"
      />
    </div>

    <CreateTripFlow />
  </div>
</template>

<style lang="scss" scoped>
.trips-hub-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: 16px;

  &.has-error {
    justify-content: center;

    .hub-header,
    .hub-controls-wrapper {
      display: none;
    }
  }
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 0 8px;

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
  }
}

.hub-controls-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hub-controls {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 16px;
  padding: 0 8px;
}

.mobile-tab-info {
  text-align: center;
  animation: fade-in 0.3s ease;

  .mobile-tab-label {
    display: inline-block;
    padding: 4px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-accent-color);
    border-radius: var(--r-full);
    text-transform: none;
    letter-spacing: 1px;
  }
}

.spacer {
  flex-grow: 1;
}

.advanced-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  padding: 16px;
  margin: 0 8px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);

  &-divider {
    margin-top: 8px;
    margin-bottom: 16px;
  }
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    padding-left: 4px;
  }
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
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

.hub-content {
  margin-top: 8px;

  &.display-mode--column :deep(.async-state-wrapper-content) {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;

    .travel-card-wrapper {
      flex-basis: 460px;
      flex-grow: 1;
    }
  }

  &.display-mode--row :deep(.async-state-wrapper-content) {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
}
</style>
