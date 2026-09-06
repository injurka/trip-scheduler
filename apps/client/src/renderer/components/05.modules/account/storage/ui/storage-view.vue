<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import type { TripImagePlacement } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitPagination } from '~/components/01.kit/kit-pagination'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useStorageModule } from '~/components/05.modules/account/storage/composables/use-storage'
import { formatDate } from '~/shared/lib/date-time'
import { useAuthStore } from '~/shared/store/auth.store'
import StorageChart from './storage-chart.vue'

const authStore = useAuthStore()
const confirm = useConfirm()

const {
  files,
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

const isFiltersOpen = ref(false)
const isChartVisible = ref(false)

const viewModeItems: ViewSwitcherItem[] = [
  { id: 'grid', label: '', icon: 'mdi:view-grid-outline' },
  { id: 'list', label: '', icon: 'mdi:view-list-outline' },
]

const chartViewItems: ViewSwitcherItem<'byTrip' | 'byPlacement'>[] = [
  { id: 'byTrip', label: 'По путешествиям' },
  { id: 'byPlacement', label: 'По секциям' },
]

const sortOptions = [
  { value: 'createdAt-desc', label: 'Сначала новые', icon: 'mdi:clock-outline' },
  { value: 'createdAt-asc', label: 'Сначала старые', icon: 'mdi:clock-time-four-outline' },
  { value: 'sizeBytes-desc', label: 'Сначала большие', icon: 'mdi:sort-numeric-descending' },
  { value: 'sizeBytes-asc', label: 'Сначала маленькие', icon: 'mdi:sort-numeric-ascending' },
  { value: 'originalName-asc', label: 'По имени (А-Я)', icon: 'mdi:sort-alphabetical-ascending' },
  { value: 'originalName-desc', label: 'По имени (Я-А)', icon: 'mdi:sort-alphabetical-descending' },
]

const currentSort = computed({
  get: () => `${sortBy.key}-${sortBy.order}`,
  set: (val: string) => {
    const [k, o] = val.split('-')
    sortBy.key = k as any
    sortBy.order = o as any
  },
})

const itemsPerPageOptions = [
  { value: 24, label: '24 на странице' },
  { value: 48, label: '48 на странице' },
  { value: 96, label: '96 на странице' },
]

// Квота хранилища
const maxStorageBytes = computed(() => authStore.user?.plan?.maxStorageBytes || 0)
const storagePercentage = computed(() => {
  if (!maxStorageBytes.value || maxStorageBytes.value === 0)
    return 0
  return Math.min(100, Math.round((totalStorageUsed.value / maxStorageBytes.value) * 100))
})

const memoriesFilesCount = computed(() => files.value.filter(f => f.placement === 'memories').length)
const routeFilesCount = computed(() => files.value.filter(f => f.placement === 'route').length)

const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.tripId)
    count++
  if (filters.extension)
    count++
  if (filters.placement)
    count++
  if (filters.sizeMin !== null && filters.sizeMin !== undefined && filters.sizeMin !== ('' as any))
    count++
  if (filters.sizeMax !== null && filters.sizeMax !== undefined && filters.sizeMax !== ('' as any))
    count++
  return count
})

function clearAllFilters() {
  filters.search = ''
  filters.tripId = ''
  filters.extension = ''
  filters.placement = ''
  filters.sizeMin = null
  filters.sizeMax = null
}

// Просмотрщик изображений
const imageViewer = useImageViewer({ enableKeyboard: true })

const viewerImages = computed<ImageViewerImage[]>(() => {
  return filteredAndSortedFiles.value.map(file => ({
    url: file.url,
    variants: file.variants,
    alt: file.originalName,
    caption: file.trip ? `Из путешествия: ${file.trip.title}` : 'Без путешествия',
    meta: {
      imageId: file.id,
      latitude: file.latitude,
      longitude: file.longitude,
      takenAt: file.takenAt,
    },
  }))
})

function openViewer(fileId: string) {
  const index = filteredAndSortedFiles.value.findIndex(f => f.id === fileId)
  if (index !== -1) {
    imageViewer.open(viewerImages.value, index)
  }
}

function formatPlacement(placement: TripImagePlacement) {
  const map = {
    route: 'Маршрут',
    memories: 'Воспоминания',
  } as Record<TripImagePlacement, string>

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
    confirmText: 'Удалить',
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
    <!-- Шапка страницы -->
    <header class="storage-header">
      <NavigationBack />
      <div class="header-titles">
        <h1 class="page-title">
          Управление хранилищем
        </h1>
        <p class="page-subtitle">
          Аналитика занятого пространства, поиск и управление всеми медиафайлами
        </p>
      </div>
    </header>

    <!-- Главная информационная карточка (Storage Overview Hero) -->
    <section class="storage-hero-card">
      <div class="hero-top-row">
        <div class="hero-main-stat">
          <div class="stat-icon-wrap">
            <Icon icon="mdi:cloud-upload-outline" />
          </div>
          <div class="stat-info">
            <span class="stat-label">Использовано хранилища</span>
            <div class="stat-value-group">
              <KitSkeleton v-if="isLoading" width="120px" height="32px" border-radius="6px" />
              <span v-else class="stat-value">{{ formatBytes(totalStorageUsed) }}</span>
              <span v-if="maxStorageBytes > 0" class="stat-limit">
                из {{ formatBytes(maxStorageBytes) }} ({{ storagePercentage }}%)
              </span>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <KitBtn
            variant="subtle"
            size="sm"
            icon="mdi:chart-donut"
            :color="isChartVisible ? 'primary' : 'secondary'"
            @click="isChartVisible = !isChartVisible"
          >
            {{ isChartVisible ? 'Скрыть аналитику' : 'Аналитика места' }}
          </KitBtn>
        </div>
      </div>

      <!-- Прогресс-бар квоты -->
      <div v-if="maxStorageBytes > 0" class="quota-progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${storagePercentage}%` }"
            :class="{ 'is-high': storagePercentage > 85, 'is-warning': storagePercentage > 70 && storagePercentage <= 85 }"
          />
        </div>
      </div>

      <!-- Быстрые метрики -->
      <div class="hero-metrics-row">
        <div class="metric-pill">
          <Icon icon="mdi:file-multiple-outline" class="pill-icon" />
          <span class="pill-label">Всего файлов:</span>
          <strong class="pill-value">{{ files.length }}</strong>
        </div>
        <div class="metric-pill">
          <Icon icon="mdi:image-multiple-outline" class="pill-icon memories" />
          <span class="pill-label">Воспоминания:</span>
          <strong class="pill-value">{{ memoriesFilesCount }}</strong>
        </div>
        <div class="metric-pill">
          <Icon icon="mdi:map-marker-path" class="pill-icon route" />
          <span class="pill-label">Маршрут:</span>
          <strong class="pill-value">{{ routeFilesCount }}</strong>
        </div>
      </div>
    </section>

    <!-- Раскрывающаяся секция аналитики (Диаграмма) -->
    <Transition name="expand">
      <div v-if="isChartVisible" class="analytics-card">
        <div class="analytics-header">
          <div class="analytics-title-group">
            <h3 class="analytics-title">
              Распределение объема
            </h3>
            <p class="analytics-subtitle">
              Наглядное распределение занятого места
            </p>
          </div>
          <KitViewSwitcher v-model="activeChart" :items="chartViewItems" size="sm" />
        </div>

        <div class="analytics-body">
          <div v-if="isLoading" class="chart-skeleton-wrapper">
            <KitSkeleton width="100%" height="260px" border-radius="12px" />
          </div>
          <Transition v-else name="fade-chart" mode="out-in">
            <StorageChart
              v-if="activeChart === 'byTrip'"
              key="byTrip"
              title="По путешествиям"
              :chart-data="storageByTrip"
            />
            <StorageChart
              v-else
              key="byPlacement"
              title="По секциям"
              :chart-data="storageByPlacement"
            />
          </Transition>
        </div>
      </div>
    </Transition>

    <!-- Панель управления и фильтрации -->
    <div class="toolbar-card">
      <div class="toolbar-row">
        <div class="search-box">
          <KitInput
            v-model="filters.search"
            placeholder="Поиск по названию файла..."
            icon="mdi:magnify"
            clearable
          />
        </div>

        <div class="toolbar-actions">
          <!-- Кнопка фильтра -->
          <KitBtn
            :variant="isFiltersOpen || activeFiltersCount > 0 ? 'solid' : 'outlined'"
            :color="isFiltersOpen || activeFiltersCount > 0 ? 'primary' : 'secondary'"
            size="md"
            icon="mdi:filter-variant"
            @click="isFiltersOpen = !isFiltersOpen"
          >
            <span>Фильтры</span>
            <span v-if="activeFiltersCount > 0" class="active-badge">{{ activeFiltersCount }}</span>
          </KitBtn>

          <!-- Сортировка -->
          <KitDropdown v-model="currentSort" :items="sortOptions" align="end">
            <template #trigger>
              <KitBtn variant="outlined" color="secondary" size="md" icon="mdi:sort">
                <span class="desktop-only">Сортировка</span>
              </KitBtn>
            </template>
          </KitDropdown>

          <!-- Переключатель вида (Сетка / Список) -->
          <KitViewSwitcher v-model="viewMode" :items="viewModeItems" />
        </div>
      </div>

      <!-- Раскрывающаяся панель расширенных фильтров -->
      <Transition name="expand">
        <div v-if="isFiltersOpen" class="advanced-filters-panel">
          <div class="filters-grid">
            <div class="filter-col">
              <label class="filter-field-label">Путешествие</label>
              <KitSelectWithSearch
                v-model="filters.tripId"
                :items="tripsForFilter as KitDropdownItem<string>[]"
                placeholder="Все путешествия"
                clearable
                icon="mdi:compass-outline"
                size="sm"
              />
            </div>

            <div class="filter-col">
              <label class="filter-field-label">Секция</label>
              <KitSelectWithSearch
                v-model="filters.placement"
                :items="placementsForFilter"
                placeholder="Все секции"
                clearable
                icon="mdi:folder-outline"
                size="sm"
              />
            </div>

            <div class="filter-col">
              <label class="filter-field-label">Расширение</label>
              <KitSelectWithSearch
                v-model="filters.extension"
                :items="fileExtensionsForFilter as KitDropdownItem<string>[]"
                placeholder="Все форматы"
                clearable
                icon="mdi:file-image-outline"
                size="sm"
              />
            </div>

            <div class="filter-col size-col">
              <label class="filter-field-label">Размер (МБ)</label>
              <div class="size-inputs-group">
                <KitInput v-model.number="filters.sizeMin" type="number" placeholder="От" size="sm" />
                <span class="size-dash">—</span>
                <KitInput v-model.number="filters.sizeMax" type="number" placeholder="До" size="sm" />
              </div>
            </div>
          </div>

          <div class="filters-panel-footer">
            <span class="results-hint">Найдено файлов: <strong>{{ filteredAndSortedFiles.length }}</strong></span>
            <KitBtn
              v-if="activeFiltersCount > 0 || filters.search"
              variant="subtle"
              color="secondary"
              size="sm"
              icon="mdi:close"
              @click="clearAllFilters"
            >
              Сбросить фильтры
            </KitBtn>
          </div>
        </div>
      </Transition>

      <!-- Активные фильтры (Чипсы быстрого сброса) -->
      <div v-if="activeFiltersCount > 0" class="active-chips-row">
        <span class="chips-label">Активно:</span>
        <button v-if="filters.tripId" class="filter-chip" @click="filters.tripId = ''">
          <span>Путешествие: {{ tripsForFilter.find(t => t.value === filters.tripId)?.label }}</span>
          <Icon icon="mdi:close" />
        </button>
        <button v-if="filters.placement" class="filter-chip" @click="filters.placement = ''">
          <span>Секция: {{ formatPlacement(filters.placement as any) }}</span>
          <Icon icon="mdi:close" />
        </button>
        <button v-if="filters.extension" class="filter-chip" @click="filters.extension = ''">
          <span>Формат: .{{ filters.extension }}</span>
          <Icon icon="mdi:close" />
        </button>
        <button v-if="filters.sizeMin !== null || filters.sizeMax !== null" class="filter-chip" @click="filters.sizeMin = null; filters.sizeMax = null">
          <span>Размер: {{ filters.sizeMin || 0 }} – {{ filters.sizeMax || '∞' }} МБ</span>
          <Icon icon="mdi:close" />
        </button>
      </div>
    </div>

    <!-- Список / Сетка файлов -->
    <AsyncStateWrapper :loading="isLoading" :error="error" :data="filteredAndSortedFiles">
      <template #loading>
        <div v-if="viewMode === 'grid'" class="files-grid">
          <div v-for="i in itemsPerPage" :key="i" class="file-card-skeleton">
            <KitSkeleton width="100%" height="160px" />
            <div class="file-card-skeleton-body">
              <KitSkeleton width="85%" height="16px" border-radius="4px" />
              <KitSkeleton width="45%" height="14px" border-radius="4px" />
            </div>
          </div>
        </div>

        <div v-if="viewMode === 'list'" class="files-list-wrapper">
          <div class="files-list-skeleton">
            <div v-for="i in 8" :key="i" class="list-item-skeleton">
              <KitSkeleton width="48px" height="48px" border-radius="var(--r-s)" />
              <div class="skeleton-col">
                <KitSkeleton width="180px" height="16px" border-radius="4px" />
                <KitSkeleton width="100px" height="12px" border-radius="4px" />
              </div>
              <KitSkeleton width="120px" height="16px" border-radius="4px" />
              <KitSkeleton width="80px" height="16px" border-radius="4px" />
            </div>
          </div>
        </div>
      </template>

      <template #success="{ data }">
        <!-- Сетка файлов -->
        <div v-if="viewMode === 'grid'" class="files-grid">
          <div
            v-for="file in paginatedFiles"
            :key="file.id"
            class="file-card"
            @click="openViewer(file.id)"
          >
            <div class="file-thumbnail-box">
              <KitImage
                :src="file.variants?.medium || file.variants?.small || file.url"
                :alt="file.originalName"
                class="file-img"
              />

              <!-- Бейдж секции -->
              <div class="thumbnail-badges">
                <span class="badge-placement" :class="file.placement">
                  {{ formatPlacement(file.placement) }}
                </span>
              </div>

              <!-- Быстрые действия -->
              <div class="thumbnail-overlay">
                <button
                  type="button"
                  class="action-btn zoom-btn"
                  title="Просмотр"
                  aria-label="Просмотр"
                  @click.stop="openViewer(file.id)"
                >
                  <Icon icon="mdi:eye-outline" />
                </button>
                <button
                  type="button"
                  class="action-btn delete-btn"
                  title="Удалить файл"
                  aria-label="Удалить файл"
                  @click.stop="handleDeleteFile(file.id, file.originalName)"
                >
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </div>
            </div>

            <div class="file-meta-box">
              <KitTooltip :text="file.originalName">
                <h4 class="file-title">
                  {{ file.originalName }}
                </h4>
              </KitTooltip>

              <div class="file-sub-meta">
                <span class="file-size-badge">{{ formatBytes(file.sizeBytes) }}</span>
                <span class="file-date">{{ formatDate(file.createdAt, { dateStyle: 'short' }) }}</span>
              </div>

              <div v-if="file.trip" class="file-trip-tag">
                <Icon icon="mdi:map-marker-outline" />
                <span>{{ file.trip.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Таблица файлов (Список) -->
        <div v-if="viewMode === 'list'" class="files-list-wrapper">
          <div class="table-responsive">
            <table class="files-table">
              <thead>
                <tr>
                  <th class="th-file" @click="setSort('originalName')">
                    <span>Файл</span>
                    <Icon v-if="sortBy.key === 'originalName'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </th>
                  <th class="th-trip" @click="setSort('trip.title')">
                    <span>Путешествие</span>
                    <Icon v-if="sortBy.key === 'trip.title'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </th>
                  <th class="th-placement" @click="setSort('placement')">
                    <span>Секция</span>
                    <Icon v-if="sortBy.key === 'placement'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </th>
                  <th class="th-date" @click="setSort('createdAt')">
                    <span>Дата</span>
                    <Icon v-if="sortBy.key === 'createdAt'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </th>
                  <th class="th-size" @click="setSort('sizeBytes')">
                    <span>Размер</span>
                    <Icon v-if="sortBy.key === 'sizeBytes'" :icon="sortBy.order === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </th>
                  <th class="th-actions" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="file in paginatedFiles"
                  :key="file.id"
                  class="file-row"
                  @click="openViewer(file.id)"
                >
                  <td class="td-file">
                    <div class="file-cell">
                      <KitImage :src="file.variants?.small || file.url" :alt="file.originalName" class="table-thumbnail" />
                      <span class="table-file-name" :title="file.originalName">{{ file.originalName }}</span>
                    </div>
                  </td>
                  <td class="td-trip">
                    <span class="trip-name-cell">{{ file.trip?.title || '—' }}</span>
                  </td>
                  <td class="td-placement">
                    <span class="table-placement-badge" :class="file.placement">{{ formatPlacement(file.placement) }}</span>
                  </td>
                  <td class="td-date">
                    <span class="date-cell">{{ formatDate(file.createdAt, { dateStyle: 'short' }) }}</span>
                  </td>
                  <td class="td-size">
                    <strong class="size-cell">{{ formatBytes(file.sizeBytes) }}</strong>
                  </td>
                  <td class="td-actions" @click.stop>
                    <button
                      type="button"
                      class="table-action-btn delete"
                      title="Удалить файл"
                      aria-label="Удалить файл"
                      @click="handleDeleteFile(file.id, file.originalName)"
                    >
                      <Icon icon="mdi:trash-can-outline" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Пагинация и выбор количества элементов -->
        <div v-if="data.length > 0" class="pagination-footer">
          <div class="pagination-info">
            <span>Показано <strong>{{ paginatedFiles.length }}</strong> из <strong>{{ filteredAndSortedFiles.length }}</strong> файлов</span>
          </div>

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
              size="sm"
            />
          </div>
        </div>
      </template>

      <template #empty>
        <div class="empty-state-card">
          <Icon icon="mdi:cloud-off-outline" class="empty-icon" />
          <h3 class="empty-title">
            Файлы не найдены
          </h3>
          <p class="empty-desc">
            {{ activeFiltersCount > 0 || filters.search ? 'По заданным параметрам поиска ничего не найдено.' : 'В вашем хранилище пока нет загруженных медиафайлов.' }}
          </p>
          <KitBtn
            v-if="activeFiltersCount > 0 || filters.search"
            variant="outlined"
            color="secondary"
            size="sm"
            icon="mdi:filter-remove-outline"
            @click="clearAllFilters"
          >
            Сбросить фильтры
          </KitBtn>
        </div>
      </template>
    </AsyncStateWrapper>

    <!-- Просмотрщик изображений -->
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
.storage-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 4rem;
}

.storage-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    color: var(--fg-primary-color);
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.4;
  }

  @include media-down(sm) {
    .page-title {
      font-size: 1.6rem;
    }
    .page-subtitle {
      font-size: 0.9rem;
    }
  }
}

/* Главная карточка обзора хранилища */
.storage-hero-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--s-xs);

  .hero-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .hero-main-stat {
    display: flex;
    align-items: center;
    gap: 1rem;

    .stat-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--r-m);
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      color: var(--fg-accent-color);
      flex-shrink: 0;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .stat-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value-group {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;

      .stat-value {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--fg-primary-color);
        letter-spacing: -0.02em;
      }

      .stat-limit {
        font-size: 0.9rem;
        color: var(--fg-secondary-color);
      }
    }
  }

  .quota-progress-container {
    width: 100%;

    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: var(--r-full);
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        border-radius: var(--r-full);
        transition: width 0.4s ease;

        &.is-warning {
          background-color: var(--fg-warning-color);
        }

        &.is-high {
          background-color: var(--fg-error-color);
        }
      }
    }
  }

  .hero-metrics-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-secondary-color);

    .metric-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-full);
      font-size: 0.8125rem;

      .pill-icon {
        font-size: 1rem;
        color: var(--fg-secondary-color);

        &.memories {
          color: #3b82f6;
        }
        &.route {
          color: #10b981;
        }
      }

      .pill-label {
        color: var(--fg-secondary-color);
      }

      .pill-value {
        color: var(--fg-primary-color);
      }
    }
  }
}

/* Аналитика */
.analytics-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .analytics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;

    .analytics-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .analytics-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .analytics-subtitle {
      margin: 0;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
}

/* Тулбар поиска и фильтров */
.toolbar-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .search-box {
      flex: 1;
      min-width: 0;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;

      .active-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background-color: var(--fg-accent-color);
        color: #ffffff;
        border-radius: var(--r-full);
        min-width: 18px;
        height: 18px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0 4px;
        margin-left: 4px;
      }
    }

    @include media-down(sm) {
      flex-wrap: wrap;

      .search-box {
        flex-basis: 100%;
      }

      .toolbar-actions {
        width: 100%;
        justify-content: space-between;

        :deep(.kit-view-switcher) {
          margin-left: auto;
        }
      }
    }
  }

  .advanced-filters-panel {
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .filter-col {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .filter-field-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    .size-inputs-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .size-dash {
        color: var(--fg-secondary-color);
      }
    }

    .filters-panel-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-secondary-color);

      .results-hint {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);

        strong {
          color: var(--fg-primary-color);
        }
      }
    }
  }

  .active-chips-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-secondary-color);

    .chips-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background-color: var(--bg-accent-overlay-color);
      color: var(--fg-accent-color);
      border: 1px solid var(--border-accent-color);
      border-radius: var(--r-full);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background-color: var(--bg-accent-color);
        color: var(--bg-primary-color);
      }
    }
  }
}

/* Сетка карточек */
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.file-card {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    box-shadow: var(--s-m);
    transform: translateY(-2px);

    .thumbnail-overlay {
      opacity: 1;
    }
  }

  .file-thumbnail-box {
    position: relative;
    height: 160px;
    background-color: var(--bg-tertiary-color);
    overflow: hidden;

    .file-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }

    .thumbnail-badges {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 2;

      .badge-placement {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--r-full);
        font-size: 0.7rem;
        font-weight: 600;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        color: #ffffff;

        &.memories {
          border-left: 3px solid #3b82f6;
        }
        &.route {
          border-left: 3px solid #10b981;
        }
      }
    }

    .thumbnail-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 60%, transparent 100%);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      gap: 6px;
      padding: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 3;

      .action-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.1);
        }

        &.zoom-btn {
          background-color: rgba(255, 255, 255, 0.85);
          color: var(--fg-primary-color);
        }

        &.delete-btn {
          background-color: var(--fg-error-color);
          color: #ffffff;
        }
      }
    }
  }

  .file-meta-box {
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;

    .file-title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-sub-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;

      .file-size-badge {
        font-weight: 700;
        color: var(--fg-accent-color);
      }

      .file-date {
        color: var(--fg-tertiary-color);
      }
    }

    .file-trip-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.775rem;
      color: var(--fg-secondary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
  }
}

.file-card-skeleton {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;

  .file-card-skeleton-body {
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}

/* Табличный вид */
.files-list-wrapper {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
}

.table-responsive {
  overflow-x: auto;
  width: 100%;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 760px;

  th {
    padding: 0.875rem 1.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    cursor: pointer;
    user-select: none;

    &:hover {
      color: var(--fg-primary-color);
    }
  }

  td {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border-secondary-color);
    font-size: 0.875rem;
    color: var(--fg-primary-color);
  }

  .file-row {
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: var(--bg-hover-color);
    }

    &:last-child td {
      border-bottom: none;
    }
  }

  .file-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .table-thumbnail {
      width: 40px;
      height: 40px;
      border-radius: var(--r-s);
      object-fit: cover;
      flex-shrink: 0;
    }

    .table-file-name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 250px;
    }
  }

  .trip-name-cell {
    color: var(--fg-secondary-color);
  }

  .table-placement-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    font-weight: 500;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);

    &.memories {
      color: #3b82f6;
      background-color: rgba(59, 130, 246, 0.1);
    }

    &.route {
      color: #10b981;
      background-color: rgba(16, 185, 129, 0.1);
    }
  }

  .date-cell {
    color: var(--fg-secondary-color);
  }

  .size-cell {
    font-weight: 700;
    color: var(--fg-accent-color);
  }

  .table-action-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--fg-tertiary-color);
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--bg-error-color);
      color: var(--fg-error-color);
    }
  }
}

.files-list-skeleton {
  display: flex;
  flex-direction: column;

  .list-item-skeleton {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-secondary-color);

    .skeleton-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
  }
}

/* Футер с пагинацией */
.pagination-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  flex-wrap: wrap;
  gap: 1rem;

  .pagination-info {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }

  .items-per-page-selector {
    width: 170px;
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: center;
    text-align: center;

    .items-per-page-selector {
      width: 100%;
    }
  }
}

/* Пустое состояние */
.empty-state-card {
  text-align: center;
  padding: 3.5rem 1.5rem;
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  .empty-icon {
    font-size: 3.5rem;
    color: var(--fg-tertiary-color);
    opacity: 0.7;
  }

  .empty-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .empty-desc {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    max-width: 400px;
  }
}

.desktop-only {
  @include media-down(sm) {
    display: none;
  }
}

/* Анимации */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease-out;
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
}

.fade-chart-enter-active,
.fade-chart-leave-active {
  transition: opacity 0.2s ease;
}

.fade-chart-enter-from,
.fade-chart-leave-to {
  opacity: 0;
}
</style>
