<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted } from 'vue'
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
  fetchReviews,
  fetchCountries,
  fetchCities,
  openCreateModal,
  openEditModal,
  submitReview,
  submitEditReview,
  deleteReview,
} = useDestinationReviews(props.userId)

const countryOptions = computed(() => countries.value.map(c => ({
  value: c.id,
  label: c.name,
})))

const cityOptions = computed(() => availableCities.value.map(c => ({
  value: c,
  label: c,
})))

const sortOptions = computed(() => {
  const options = [
    { value: 'createdAt-desc', label: 'Сначала новые', icon: 'mdi:clock-outline' },
    { value: 'createdAt-asc', label: 'Сначала старые', icon: 'mdi:clock-time-four-outline' },
    { value: 'rating-desc', label: 'Сначала лучшие (общий)', icon: 'mdi:star' },
    { value: 'rating-asc', label: 'Сначала худшие (общий)', icon: 'mdi:star-outline' },
  ]
  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    options.push({ value: `${key}-desc`, label: `Высшая оценка: ${label}`, icon: 'mdi:trending-up' })
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

function clearFilters() {
  selectedCountry.value = null
  selectedCity.value = null
  sortBy.value = 'createdAt'
  sortOrder.value = 'desc'
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

    <!-- Toolbar фильтров и сортировки -->
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
        <div v-if="!selectedCountry && !selectedCity" class="empty-state">
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
