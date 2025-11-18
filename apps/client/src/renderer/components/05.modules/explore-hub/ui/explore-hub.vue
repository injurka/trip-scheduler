<script setup lang="ts">
// import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { computed, onMounted, ref } from 'vue'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
// import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useExploreStore } from '~/components/04.features/explore-hub/store/explore.store'
import { PlacesFilters, PlacesList, PlacesListSkeleton, PlacesMap } from '~/components/04.features/explore-hub/ui'

const exploreStore = useExploreStore()
const { filteredPlaces, tags, isLoading, selectedTagIds, currentCity } = storeToRefs(exploreStore)

const viewMode = ref<'list' | 'map'>('list')
// const viewModeItems: ViewSwitcherItem<'list' | 'map'>[] = [
//   { id: 'list', label: 'Список', icon: 'mdi:view-list' },
//   { id: 'map', label: 'Карта', icon: 'mdi:map-outline' },
// ]

const cityOptions = ref([
  { value: 'Chongqing', label: 'Chongqing' },
  { value: 'Beijing', label: 'Beijing (нет данных)' },
])

const selectedCity = computed({
  get: () => currentCity.value,
  set: (city) => {
    if (city)
      exploreStore.fetchPlacesByCity(city)
  },
})

const mapCenter = computed((): [number, number] => {
  if (filteredPlaces.value.length > 0) {
    return [filteredPlaces.value[0].coordinates.lon, filteredPlaces.value[0].coordinates.lat]
  }
  // Default to Chongqing if no places
  return [106.5517, 29.563]
})

onMounted(() => {
  if (!currentCity.value) {
    selectedCity.value = cityOptions.value[0].value
  }
})
</script>

<template>
  <div class="explore-hub">
    <header class="hub-header">
      <div class="header-content">
        <h1>Что посетить</h1>
        <p>Исследуйте интересные места в разных городах.</p>
      </div>
      <div class="city-selector">
        <KitSelectWithSearch
          v-model="selectedCity"
          :items="cityOptions"
          placeholder="Выберите город"
          :clearable="false"
        />
      </div>
    </header>

    <div class="hub-content">
      <aside class="filters-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Фильтры
          </h2>
          <!-- <KitViewSwitcher v-model="viewMode" :items="viewModeItems" /> -->
        </div>
        <PlacesFilters
          :tags="tags"
          :selected-tag-ids="selectedTagIds"
          @toggle-tag="exploreStore.toggleTagFilter"
        />
      </aside>

      <main class="places-panel">
        <AsyncStateWrapper
          :loading="isLoading"
          :data="filteredPlaces.length > 0 ? filteredPlaces : null"
        >
          <template #loading>
            <PlacesListSkeleton />
          </template>

          <template #success="{ data }">
            <Transition name="fade-view" mode="out-in">
              <PlacesList v-if="viewMode === 'list'" :places="data" />
              <PlacesMap v-else :places="data" :center="mapCenter" />
            </Transition>
          </template>

          <template #empty>
            <div class="empty-state">
              <p>По вашему запросу ничего не найдено.</p>
              <span>Попробуйте изменить город или сбросить фильтры.</span>
            </div>
          </template>
        </AsyncStateWrapper>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.explore-hub {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 4px;
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
  }
}
.city-selector {
  min-width: 240px;
}
.hub-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  align-items: flex-start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}
.filters-panel {
  position: sticky;
  top: 80px; /* Высота хедера + отступ */
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.5rem;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-secondary-color);
}
.panel-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}
.places-panel {
  min-height: 500px;
}
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--fg-secondary-color);
  p {
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.fade-view-enter-active,
.fade-view-leave-active {
  transition: opacity 0.2s ease-in-out;
}
.fade-view-enter-from,
.fade-view-leave-to {
  opacity: 0;
}
</style>
