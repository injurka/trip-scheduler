<script setup lang="ts">
import type { IImageViewerImageMeta, ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Highlight } from '~/shared/types/models/user'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitPagination } from '~/components/01.kit/kit-pagination'
import { useAuthStore } from '~/shared/store/auth.store'
import { useHighlights } from '../composables/use-highlights'
import HighlightsCreateDialog from './dialog/highlights-create-dialog.vue'
import HighlightsEditDialog from './dialog/highlights-edit-dialog.vue'
import HighlightsToolbar from './highlights-toolbar.vue'
import PhotoCard from './photo-card.vue'
import HighlightsEmptyState from './states/highlights-empty-state.vue'
import HighlightsErrorState from './states/highlights-error-state.vue'
import HighlightsSkeleton from './states/highlights-skeleton.vue'

const authStore = useAuthStore()

const {
  userId,
  highlights,
  filteredHighlights,
  totalItems,
  currentPage,
  itemsPerPage,
  countries,
  mapPoints,
  quality,
  selectedCities,
  dateRange,
  availableCities,
  isLoading,
  fetchError,
  isUploading,
  isSubmitting,
  areCountriesLoading,
  isCreateModalOpen,
  isEditModalOpen,
  form,
  editForm,
  formFile,
  editFormFile,
  fetchHighlights,
  fetchHighlightCities,
  openCreateModal,
  openEditModal,
  handleFileSelect,
  handleEditFileSelect,
  submitHighlight,
  submitEditHighlight,
  deleteHighlight,
} = useHighlights()

const isOwner = computed(() => authStore.user?.id === userId.value)

const viewerVisible = ref(false)
const viewerIndex = ref(0)
const isViewerFetching = ref(false)
const pendingViewerIndex = ref<number | null>(null)

const viewerImages = computed<ImageViewerImage[]>(() =>
  filteredHighlights.value.map((item: Highlight) => ({
    url: item.imageUrl,
    alt: [item.city, item.country?.name].filter(Boolean).join(', ') || 'Highlight image',
    caption: item.comment || null,
    variants: item.variants as Record<string, string> | undefined,
    meta: {
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      takenAt: item.takenAt ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      imageId: item.id,
    } as IImageViewerImageMeta & { imageId: string },
  })),
)

const currentViewerHighlight = computed<Highlight | null>(() =>
  filteredHighlights.value[viewerIndex.value] ?? null,
)

const viewerLocation = computed(() => {
  const item = currentViewerHighlight.value
  if (!item)
    return 'Локация не указана'

  return [item.city, item.country?.name].filter(Boolean).join(', ') || 'Локация не указана'
})

const viewerAddress = computed(() =>
  currentViewerHighlight.value?.address?.trim() || '',
)

const viewerComment = computed(() =>
  currentViewerHighlight.value?.comment?.trim() || '',
)

const viewerDate = computed(() => {
  const takenAt = currentViewerHighlight.value?.takenAt
  if (!takenAt)
    return ''

  return new Date(takenAt).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

function openViewer(photo: Highlight) {
  const index = filteredHighlights.value.findIndex((item: Highlight) => item.id === photo.id)
  if (index < 0)
    return

  viewerIndex.value = index
  viewerVisible.value = true
}

function handleViewerNextPage() {
  if (currentPage.value * itemsPerPage < totalItems.value) {
    isViewerFetching.value = true
    pendingViewerIndex.value = 0
    currentPage.value++
  }
}

function handleViewerPrevPage() {
  if (currentPage.value > 1) {
    isViewerFetching.value = true
    pendingViewerIndex.value = itemsPerPage - 1
    currentPage.value--
  }
}

watch(highlights, () => {
  if (isViewerFetching.value && pendingViewerIndex.value !== null) {
    viewerIndex.value = pendingViewerIndex.value
    pendingViewerIndex.value = null
    isViewerFetching.value = false
  }
})

watch(isLoading, (loading) => {
  if (!loading && isViewerFetching.value) {
    if (pendingViewerIndex.value !== null) {
      viewerIndex.value = pendingViewerIndex.value
      pendingViewerIndex.value = null
    }
    isViewerFetching.value = false
  }
})

function clearFilters() {
  selectedCities.value = []
  dateRange.value = null
}

onMounted(() => {
  fetchHighlights()
  fetchHighlightCities()
})
</script>

<template>
  <div class="highlights-feed">
    <!-- Идентичный тулбар-заголовок, как во Впечатлениях -->
    <div class="toolbar">
      <h2 class="title">
        {{ isOwner ? 'Моя витрина' : 'Витрина' }}
      </h2>
      <div style="flex-grow: 1" />
      <KitBtn
        v-if="isOwner"
        size="sm"
        icon="mdi:plus"
        :loading="areCountriesLoading"
        @click="openCreateModal"
      >
        <span class="desktop-only">Добавить</span>
      </KitBtn>
    </div>

    <!-- Тулбар для фильтров -->
    <HighlightsToolbar
      v-model:quality="quality"
      v-model:selected-cities="selectedCities"
      v-model:date-range="dateRange"
      :available-cities="availableCities"
    />

    <HighlightsSkeleton v-if="isLoading" />

    <HighlightsErrorState v-else-if="fetchError && highlights.length === 0" @retry="fetchHighlights" />

    <HighlightsEmptyState v-else-if="!isLoading && highlights.length === 0 && selectedCities.length === 0 && !dateRange" :is-owner="isOwner" />

    <div v-else-if="!isLoading && filteredHighlights.length === 0" class="empty-filters-state">
      <Icon icon="mdi:filter-variant-remove" class="empty-icon" />
      <p>Ничего не найдено по выбранным фильтрам.</p>
      <KitBtn variant="subtle" size="sm" @click="clearFilters">
        Сбросить фильтры
      </KitBtn>
    </div>

    <template v-else>
      <div class="highlights-grid">
        <PhotoCard
          v-for="item in filteredHighlights"
          :key="item.id"
          :photo="item"
          :quality="quality"
          :is-owner="isOwner"
          @click="openViewer(item)"
          @edit="openEditModal"
          @delete="deleteHighlight"
        />
      </div>

      <div v-if="totalItems > itemsPerPage" class="pagination-wrapper">
        <KitPagination
          v-model:current-page="currentPage"
          :total-items="totalItems"
          :items-per-page="itemsPerPage"
        />
      </div>
    </template>

    <HighlightsCreateDialog
      v-model:visible="isCreateModalOpen"
      :countries="countries"
      :map-points="mapPoints"
      :form="form"
      :file="formFile"
      :is-uploading="isUploading"
      :is-submitting="isSubmitting"
      @file-select="handleFileSelect"
      @submit="submitHighlight"
    />

    <HighlightsEditDialog
      v-model:visible="isEditModalOpen"
      :countries="countries"
      :map-points="mapPoints"
      :form="editForm"
      :file="editFormFile"
      :is-uploading="isUploading"
      :is-submitting="isSubmitting"
      @file-select="handleEditFileSelect"
      @submit="submitEditHighlight"
    />

    <KitImageViewer
      v-model:visible="viewerVisible"
      v-model:current-index="viewerIndex"
      :images="viewerImages"
      :show-counter="viewerImages.length > 1"
      :enable-thumbnails="false"
      :show-info-button="true"
      :show-quality-selector="true"
      :has-next-page="currentPage * itemsPerPage < totalItems"
      :has-prev-page="currentPage > 1"
      :is-fetching="isViewerFetching"
      @next-page="handleViewerNextPage"
      @prev-page="handleViewerPrevPage"
    >
      <template #footer>
        <div v-if="currentViewerHighlight" class="viewer-caption">
          <div class="header">
            <div class="location-wrap">
              <img
                v-if="currentViewerHighlight.country?.flagUrl"
                :src="currentViewerHighlight.country.flagUrl"
                :alt="currentViewerHighlight.country?.name || ''"
                class="flag"
              >
              <h4 class="location">
                {{ viewerLocation }}
              </h4>
            </div>

            <span v-if="viewerDate" class="date">
              <Icon icon="mdi:calendar-blank-outline" class="icon" />
              {{ viewerDate }}
            </span>
          </div>

          <p v-if="viewerAddress" class="address">
            <Icon icon="mdi:map-marker-outline" class="icon" />
            <span>{{ viewerAddress }}</span>
          </p>

          <p
            v-if="viewerComment"
            class="comment"
          >
            {{ viewerComment }}
          </p>
        </div>
      </template>
    </KitImageViewer>
  </div>
</template>

<style scoped lang="scss">
.highlights-feed {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px; /* Было 24px, изменил на 20px для соответствия отступам как в Впечатлениях */
}

/* Общий стиль тулбара с кнопкой */
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

.desktop-only {
  @include media-down(sm) {
    display: none;
  }
}

.highlights-grid {
  column-count: 3;
  column-gap: 6px;
  width: 100%;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0 24px;
}

.empty-filters-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  gap: 12px;

  .empty-icon {
    font-size: 3rem;
    color: var(--fg-tertiary-color);
  }

  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
  }
}

.viewer-caption {
  width: min(680px, calc(100% - 32px));
  margin: 0 auto 12px;
  padding: 12px 18px;
  border-radius: var(--r-m);
  background: rgba(18, 18, 18, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.36);
  color: white;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .location-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .flag {
    width: 18px;
    height: 12px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .location {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .date {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    font-size: 0.8rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.65);
    white-space: nowrap;
  }

  .address {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .comment {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.92);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .icon {
    font-size: 0.95rem;
    flex-shrink: 0;
    opacity: 0.75;
  }
}

@media (max-width: 1280px) {
  .highlights-grid {
    column-count: 2;
  }
}

@media (max-width: 768px) {
  .highlights-grid {
    column-count: 1;
    column-gap: 0;
  }

  .viewer-caption {
    width: calc(100% - 16px);
    margin-bottom: 8px;
    padding: 10px 14px;
    gap: 5px;

    .header {
      flex-wrap: wrap;
      gap: 4px 10px;
    }

    .location {
      font-size: 0.9rem;
    }

    .date,
    .address {
      font-size: 0.75rem;
    }

    .comment {
      font-size: 0.82rem;
    }
  }
}
</style>
