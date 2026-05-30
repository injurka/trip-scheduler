<script setup lang="ts">
import type { DestinationMetricKey } from '../composables/use-destination-reviews'
import type { Country } from '~/shared/types/models/destination-review'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitPagination } from '~/components/01.kit/kit-pagination'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { METRIC_LABELS, useDestinationReviews } from '../composables/use-destination-reviews'
import DestinationReviewCardSkeleton from './components/destination-review-card-skeleton.vue'
import DestinationReviewCard from './components/destination-review-card.vue'
import DestinationReviewCreateDialog from './dialogs/destination-review-create-dialog.vue'
import DestinationReviewEditDialog from './dialogs/destination-review-edit-dialog.vue'

interface Props {
  userId: string
  isOwnProfile: boolean
}
const props = defineProps<Props>()

const {
  filteredReviews,
  totalItems,
  page,
  limit,
  countries,
  availableCities,
  selectedCountry,
  selectedCity,
  sortBy,
  sortOrder,
  activePreset,
  selectedMetrics,
  METRIC_PRESETS,
  METRIC_KEYS,
  areReviewsLoading,
  areCountriesLoading,
  isSubmitting,
  isUploading,
  isCreateModalOpen,
  isEditModalOpen,
  form,
  editForm,
  formFile,
  editFormFile,
  applyPreset,
  toggleMetric,
  fetchReviews,
  fetchCountries,
  fetchCities,
  openCreateModal,
  openEditModal,
  submitReview,
  submitEditReview,
  deleteReview,
} = useDestinationReviews(props.userId)

const countryOptions = computed(() => countries.value.map((c: Country) => ({
  value: c.id,
  label: c.name,
})))

const cityOptions = computed(() => availableCities.value.map(c => ({
  value: c,
  label: c,
})))

// Опции сортировки динамически адаптируются под выбранные метрики
const sortOptions = computed(() => {
  const options = [
    { value: 'createdAt-desc', label: 'Сначала новые', icon: 'mdi:clock-outline' },
    { value: 'createdAt-asc', label: 'Сначала старые', icon: 'mdi:clock-time-four-outline' },
    { value: 'rating-desc', label: 'Сначала лучшие (по выбранным)', icon: 'mdi:star' },
    { value: 'rating-asc', label: 'Сначала худшие (по выбранным)', icon: 'mdi:star-outline' },
  ]

  // Добавляем в сортировку только ТЕ метрики, которые сейчас выбраны в настройках
  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    if (selectedMetrics.value.includes(key as DestinationMetricKey)) {
      options.push({ value: `${key}-desc`, label: `Высшая оценка: ${label}`, icon: 'mdi:trending-up' })
    }
  }
  return options
})

const activeSortOption = computed({
  get: () => `${sortBy.value}-${sortOrder.value}`,
  set: (val: string) => {
    const [newSortBy, newSortOrder] = val.split('-')
    sortBy.value = newSortBy
    sortOrder.value = newSortOrder as 'asc' | 'desc'
  },
})

const showMetricsSetup = ref(false)

function clearFilters() {
  selectedCountry.value = null
  selectedCity.value = null
  sortBy.value = 'createdAt'
  sortOrder.value = 'desc'
  applyPreset('all') // Сбрасываем выбранные атрибуты до стандартных
}

onMounted(() => {
  fetchCountries()
  fetchCities()
  fetchReviews()
})
</script>

<template>
  <div class="reviews-view">
    <div class="toolbar">
      <h2 class="title">
        Мои впечатления
      </h2>
      <div style="flex-grow: 1" />
      <KitBtn
        v-if="isOwnProfile"
        size="sm"
        icon="mdi:plus"
        :loading="areCountriesLoading"
        @click="openCreateModal"
      >
        <span class="desktop-only">Добавить</span>
      </KitBtn>
    </div>

    <!-- Основные Фильтры -->
    <div class="filters-bar">
      <KitSelectWithSearch
        v-model="selectedCountry"
        :items="countryOptions"
        placeholder="Все страны"
        clearable
        size="sm"
        class="filter-select"
        icon="mdi:earth"
      />
      <KitSelectWithSearch
        v-model="selectedCity"
        :items="cityOptions"
        placeholder="Все города"
        clearable
        size="sm"
        class="filter-select"
        icon="mdi:city"
      />

      <div style="flex-grow: 1" />

      <!-- Кнопка раскрытия настроек метрик -->
      <KitBtn
        :variant="showMetricsSetup || activePreset !== 'all' ? 'solid' : 'outlined'"
        :color="showMetricsSetup || activePreset !== 'all' ? 'primary' : 'secondary'"
        size="sm"
        icon="mdi:tune-variant"
        @click="showMetricsSetup = !showMetricsSetup"
      >
        <span class="desktop-only">Атрибуты</span>
        <span v-if="activePreset !== 'all'" class="metrics-badge">{{ selectedMetrics.length }}</span>
      </KitBtn>

      <KitDropdown
        v-model="activeSortOption"
        :items="sortOptions"
        align="end"
      >
        <template #trigger>
          <KitBtn variant="outlined" color="secondary" size="sm" icon="mdi:sort-variant">
            <span class="desktop-only">Сортировка</span>
          </KitBtn>
        </template>
      </KitDropdown>
    </div>

    <!-- Настройка оценки (кастомизация атрибутов) -->
    <Transition name="fade-slide">
      <div v-show="showMetricsSetup" class="metrics-customization">
        <div class="customization-header">
          <span class="customization-label">Режим оценки:</span>
          <div class="presets-group">
            <KitBtn
              v-for="preset in METRIC_PRESETS"
              :key="preset.id"
              size="xs"
              :variant="activePreset === preset.id ? 'solid' : 'outlined'"
              :color="activePreset === preset.id ? 'primary' : 'secondary'"
              :icon="preset.icon"
              @click="applyPreset(preset.id)"
            >
              {{ preset.label }}
            </KitBtn>
          </div>
        </div>
        <div class="metrics-chips">
          <button
            v-for="key in METRIC_KEYS"
            :key="key"
            class="metric-chip"
            :class="{ active: selectedMetrics.includes(key) }"
            @click="toggleMetric(key)"
          >
            {{ METRIC_LABELS[key] }}
          </button>
        </div>
      </div>
    </Transition>

    <AsyncStateWrapper :loading="areReviewsLoading" :data="filteredReviews.length > 0 ? filteredReviews : null">
      <template #loading>
        <div class="reviews-grid">
          <DestinationReviewCardSkeleton v-for="n in 7" :key="n" />
        </div>
      </template>

      <template #success="{ data }">
        <div class="reviews-grid">
          <DestinationReviewCard
            v-for="review in data"
            :key="review.id"
            :review="review"
            :is-owner="isOwnProfile"
            :selected-metrics="selectedMetrics"
            @edit="openEditModal"
            @delete="deleteReview"
          />
        </div>

        <div v-if="totalItems > limit" class="pagination-wrapper">
          <KitPagination
            v-model:current-page="page"
            :total-items="totalItems"
            :items-per-page="limit"
          />
        </div>
      </template>

      <template #empty>
        <div v-if="!selectedCountry && !selectedCity && activePreset === 'all'" class="empty-state">
          <Icon icon="mdi:map-search-outline" />
          <p>Пока нет добавленных впечатлений.</p>
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

    <DestinationReviewCreateDialog
      v-model:visible="isCreateModalOpen"
      v-model:file="formFile"
      :countries="countries"
      :form="form"
      :is-uploading="isUploading"
      :is-submitting="isSubmitting"
      @submit="submitReview"
    />

    <DestinationReviewEditDialog
      v-model:visible="isEditModalOpen"
      v-model:file="editFormFile"
      :countries="countries"
      :form="editForm"
      :is-uploading="isUploading"
      :is-submitting="isSubmitting"
      @submit="submitEditReview"
    />
  </div>
</template>

<style scoped lang="scss">
.reviews-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;

  .title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filter-select {
  width: 220px;
  max-width: 100%;
}

/* Бейдж для кнопки фильтра метрик */
.metrics-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  border-radius: var(--r-full);
  min-width: 20px;
  height: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-left: 6px;
  padding: 0 6px;
}

/* Анимация раскрытия панели */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.metrics-customization {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .customization-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .customization-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .presets-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .metrics-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
  }

  .metric-chip {
    padding: 6px 12px;
    font-size: 0.8rem;
    border-radius: var(--r-full);
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-primary-color);
      border-color: var(--fg-accent-color);
    }

    &.active {
      background: var(--fg-accent-color);
      color: var(--bg-primary-color);
      border-color: var(--fg-accent-color);
      font-weight: 500;
    }
  }
}

.reviews-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0;
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

  .iconify {
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

@include media-down(sm) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-select {
    width: 100%;
  }
}
</style>
