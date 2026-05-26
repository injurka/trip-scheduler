<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Highlight } from '~/shared/types/models/user'
import { computed, onMounted, ref } from 'vue'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
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
  countries,
  reviews,
  quality,
  isLoading,
  isUploading,
  isSubmitting,
  isCreateModalOpen,
  isEditModalOpen,
  form,
  editForm,
  formFile,
  editFormFile,
  fetchHighlights,
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

const highlightsData = computed(() =>
  highlights.value.length > 0 ? highlights.value : null,
)

const viewerImages = computed<ImageViewerImage[]>(() =>
  highlights.value.map(item => ({
    url: item.imageUrl,
    alt: [item.city, item.country?.name].filter(Boolean).join(', ') || 'Highlight image',
    caption: item.comment || null,
    variants: item.variants as Record<string, string> | undefined,
    meta: {
      ...((item.metadata as Record<string, any>) || {}),
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      takenAt: item.takenAt ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      imageId: (item.metadata as any)?.imageId ?? item.id,
    } as any,
  })),
)

const currentViewerHighlight = computed<Highlight | null>(() =>
  highlights.value[viewerIndex.value] ?? null,
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
  const index = highlights.value.findIndex(item => item.id === photo.id)
  if (index < 0)
    return

  viewerIndex.value = index
  viewerVisible.value = true
}

onMounted(fetchHighlights)
</script>

<template>
  <div class="highlights-feed">
    <HighlightsToolbar
      v-if="isOwner"
      v-model:quality="quality"
      @create="openCreateModal"
    />

    <AsyncStateWrapper
      :loading="isLoading"
      :data="highlightsData"
    >
      <template #loading>
        <HighlightsSkeleton />
      </template>

      <template #success="{ data }">
        <div class="highlights-grid">
          <PhotoCard
            v-for="item in data"
            :key="item.id"
            :photo="item"
            :quality="quality"
            :is-owner="isOwner"
            @click="openViewer(item)"
            @edit="openEditModal"
            @delete="deleteHighlight"
          />
        </div>
      </template>

      <template #empty>
        <HighlightsEmptyState :is-owner="isOwner" />
      </template>

      <template #error>
        <HighlightsErrorState @retry="fetchHighlights" />
      </template>
    </AsyncStateWrapper>

    <HighlightsCreateDialog
      v-model:visible="isCreateModalOpen"
      :countries="countries"
      :reviews="reviews"
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
      :reviews="reviews"
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
    >
      <template #footer>
        <div v-if="currentViewerHighlight" class="viewer-caption">
          <div class="viewer-caption__content">
            <h4 class="viewer-caption__location">
              {{ viewerLocation }}
            </h4>

            <p v-if="viewerAddress" class="viewer-caption__address">
              {{ viewerAddress }}
            </p>

            <p
              class="viewer-caption__comment"
              :class="{ 'viewer-caption__comment--empty': !viewerComment }"
            >
              {{ viewerComment || 'Комментарий к фото не добавлен' }}
            </p>
          </div>

          <div class="viewer-caption__meta">
            <span v-if="viewerDate" class="viewer-pill">
              {{ viewerDate }}
            </span>
          </div>
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
  gap: 24px;
}

.highlights-grid {
  column-count: 3;
  column-gap: 6px;
  width: 100%;
}

.viewer-caption {
  width: min(920px, calc(100% - 24px));
  margin: 0 auto 14px;
  padding: 14px 16px;
  border-radius: var(--r-l);
  background: rgba(10, 10, 10, 0.72);
  backdrop-filter: blur(4px);
  color: white;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  pointer-events: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
}

.viewer-caption__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.viewer-caption__location {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: white;
}

.viewer-caption__address {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.78);
}

.viewer-caption__comment {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.96);
  white-space: pre-wrap;
  word-break: break-word;
}

.viewer-caption__comment--empty {
  color: rgba(255, 255, 255, 0.58);
}

.viewer-caption__meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.viewer-pill {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-full);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
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
    padding: 12px;
    flex-direction: column;
    align-items: flex-start;
  }

  .viewer-caption__meta {
    width: 100%;
  }
}
</style>
