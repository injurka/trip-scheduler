<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import type { TripImagePlacement } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitPagination } from '~/components/01.kit/kit-pagination'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useStorageModule } from '~/components/05.modules/account/storage/composables/use-storage'
import StorageChart from './storage-chart.vue'

const {
  filteredAndSortedFiles,
  isLoading,
  error,
  viewMode,
  filters,
  totalStorageUsed,
  fetchFiles,
  deleteFile,
  tripsForFilter,
  fileExtensionsForFilter,
  placementsForFilter,
  storageByTrip,
  storageByPlacement,
  activeChart,
  setSort,
  sortBy,
  currentPage,
  itemsPerPage,
  paginatedFiles,
} = useStorageModule()
const confirm = useConfirm()

const isFiltersOpen = ref(false)

const viewModeItems: ViewSwitcherItem[] = [
  { id: 'grid', label: '', icon: 'mdi:view-grid-outline' },
  { id: 'list', label: '', icon: 'mdi:view-list-outline' },
]

const chartViewItems: ViewSwitcherItem<'byTrip' | 'byPlacement'>[] = [
  { id: 'byTrip', label: 'По путешествиям' },
  { id: 'byPlacement', label: 'По секциям' },
]

const itemsPerPageOptions = [
  { value: 24, label: '24 на странице' },
  { value: 48, label: '48 на странице' },
  { value: 96, label: '96 на странице' },
]

function formatPlacement(placement: TripImagePlacement) {
  const map: Record<TripImagePlacement, string> = {
    route: 'Маршрут',
    memories: 'Воспоминания',
  }
  return map[placement] || placement
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0)
    return '0 Байт'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

async function handleDeleteFile(fileId: string, fileName: string) {
  const isConfirmed = await confirm({
    title: `Удалить файл "${fileName}"?`,
    description: 'Файл будет удален навсегда. Это действие нельзя отменить.',
    type: 'danger',
  })
  if (isConfirmed) {
    deleteFile(fileId)
  }
}

onMounted(() => {
  fetchFiles()
})
</script>

<template>
  <div class="storage-page">
    <header class="storage-header">
      <NavigationBack />
      <h1>Управление хранилищем</h1>
      <p>Общий размер файлов: <strong>{{ formatBytes(totalStorageUsed) }}</strong></p>
    </header>

    <div class="chart-section">
      <KitViewSwitcher v-model="activeChart" :items="chartViewItems" full-width />
      <Transition name="slide-fade" mode="out-in">
        <StorageChart
          v-if="activeChart === 'byTrip'"
          key="byTrip"
          title="Распределение места по путешествиям"
          :chart-data="storageByTrip"
        />
        <StorageChart
          v-else
          key="byPlacement"
          title="Распределение места по секциям"
          :chart-data="storageByPlacement"
        />
      </Transition>
    </div>

    <div class="controls-wrapper">
      <div class="controls-panel">
        <KitInput v-model="filters.search" placeholder="Поиск по названию..." icon="mdi:magnify" class="search-input" />
        <KitBtn
          icon="mdi:filter-variant"
          variant="outlined"
          :class="{ 'is-active': isFiltersOpen }"
          @click="isFiltersOpen = !isFiltersOpen"
        />
        <KitViewSwitcher v-model="viewMode" :items="viewModeItems" />
      </div>

      <Transition name="slide-fade">
        <div v-if="isFiltersOpen" class="advanced-filters">
          <KitSelectWithSearch
            v-model="filters.tripId"
            :items="tripsForFilter as KitDropdownItem<string>[]"
            placeholder="Фильтр по путешествиям"
          />
          <KitSelectWithSearch
            v-model="filters.extension"
            :items="fileExtensionsForFilter as KitDropdownItem<string>[]"
            placeholder="Фильтр по расширению"
          />
          <KitSelectWithSearch
            v-model="filters.placement"
            :items="placementsForFilter"
            placeholder="Фильтр по секциям"
          />
          <div class="size-filter">
            <KitInput v-model="filters.sizeMin" type="number" placeholder="Размер от (МБ)" />
            <span>-</span>
            <KitInput v-model="filters.sizeMax" type="number" placeholder="до (МБ)" />
          </div>
        </div>
      </Transition>
    </div>

    <AsyncStateWrapper :loading="isLoading" :error="error" :data="filteredAndSortedFiles">
      <template #loading>
        <div class="loading-state">
          Загрузка файлов...
        </div>
      </template>

      <template #success="{ data }">
        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="files-grid">
          <div v-for="file in paginatedFiles" :key="file.id" class="file-card">
            <div class="file-card-image">
              <KitImage :src="file.variants?.small || file.url" :alt="file.originalName" />
            </div>
            <div class="file-card-info">
              <span class="file-name" :title="file.originalName">{{ file.originalName }}</span>
              <span class="file-size">{{ formatBytes(file.sizeBytes) }}</span>
            </div>
            <button class="delete-btn" title="Удалить" @click="handleDeleteFile(file.id, file.originalName)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </div>

        <!-- List View -->
        <div v-if="viewMode === 'list'" class="files-list-wrapper">
          <div class="files-list">
            <div class="list-header-row">
              <button class="sortable-header" @click="setSort('originalName')">
                <span>Файл</span>
                <Icon v-if="sortBy.key === 'originalName'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
              </button>
              <button class="sortable-header" @click="setSort('trip.title')">
                <span>Путешествие</span>
                <Icon v-if="sortBy.key === 'trip.title'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
              </button>
              <button class="sortable-header" @click="setSort('placement')">
                <span>Тип</span>
                <Icon v-if="sortBy.key === 'placement'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
              </button>
              <button class="sortable-header" @click="setSort('createdAt')">
                <span>Дата</span>
                <Icon v-if="sortBy.key === 'createdAt'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
              </button>
              <button class="sortable-header" @click="setSort('sizeBytes')">
                <span>Размер</span>
                <Icon v-if="sortBy.key === 'sizeBytes'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
              </button>
              <span />
            </div>
            <div v-for="file in paginatedFiles" :key="file.id" class="list-item-row">
              <div class="file-info-cell">
                <KitImage :src="file.variants?.small || file.url" :alt="file.originalName" class="file-thumbnail" />
                <span>{{ file.originalName }}</span>
              </div>
              <div>{{ file.trip?.title || 'Без путешествия' }}</div>
              <div>{{ formatPlacement(file.placement) }}</div>
              <div>{{ formatDate(file.createdAt, { dateStyle: 'short' }) }}</div>
              <div>{{ formatBytes(file.sizeBytes) }}</div>
              <div class="actions-cell">
                <button class="delete-btn" title="Удалить" @click="handleDeleteFile(file.id, file.originalName)">
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination Controls -->
        <div v-if="data.length > 0" class="pagination-controls">
          <KitPagination
            :current-page="currentPage"
            :total-items="filteredAndSortedFiles.length"
            :items-per-page="itemsPerPage"
            @update:current-page="currentPage = $event"
          />
          <div class="items-per-page-selector">
            <KitSelectWithSearch
              v-model="itemsPerPage"
              :items="itemsPerPageOptions"
              :clearable="false"
            />
          </div>
        </div>
      </template>

      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:cloud-off-outline" />
          <p>Ваше хранилище пусто.</p>
        </div>
      </template>
    </AsyncStateWrapper>
  </div>
</template>

<style scoped lang="scss">
.storage-page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.storage-header {
  position: relative;
  h1 {
    font-size: 2rem;
    font-weight: 700;
  }
  p {
    color: var(--fg-secondary-color);
  }
}

.chart-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls-panel {
  display: flex;
  gap: 1rem;
  align-items: center;

  .search-input {
    flex-grow: 1;
  }

  .kit-btn.is-active {
    border-color: var(--border-accent-color);
    color: var(--fg-accent-color);
    background-color: var(--bg-accent-color-translucent);
  }
}

.advanced-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  background-color: var(--bg-tertiary-color);
  padding: 1rem;
  border-radius: var(--r-m);
}

.size-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  span {
    color: var(--fg-secondary-color);
  }
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.file-card {
  position: relative;
  border-radius: var(--r-xs);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;

  &:hover .delete-btn {
    opacity: 1;
    transform: translateY(0);
  }
}

.file-card-image {
  height: 150px;
}

.file-card-info {
  padding: 0.75rem;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-size {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background-color: var(--fg-error-color);
  color: white;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
}

.file-card .delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transform: translateY(-10px);
}

.files-list-wrapper {
  overflow-x: auto;
  width: 100%;
}

.files-list {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
  min-width: 900px;
}

.list-header-row,
.list-item-row {
  display: grid;
  grid-template-columns: 3fr 2fr 1fr 1fr 1fr 60px;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1.5rem;
}

.list-header-row {
  font-weight: 600;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
}

.sortable-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-weight: 600;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  text-transform: uppercase;
  font-family: inherit;
  transition: color 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
  }

  .iconify {
    font-size: 1rem;
  }
}

.list-item-row {
  border-bottom: 1px solid var(--border-secondary-color);
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.file-info-cell {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-thumbnail {
  width: 40px;
  height: 40px;
  border-radius: var(--r-s);
  flex-shrink: 0;
}

.actions-cell {
  text-align: right;
  .delete-btn {
    opacity: 1;
    position: static;
    transform: none;
  }
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 4rem;
  color: var(--fg-secondary-color);
  .iconify {
    font-size: 3rem;
    margin-bottom: 1rem;
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

.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
}

.items-per-page-selector {
  width: 180px;
}
</style>
