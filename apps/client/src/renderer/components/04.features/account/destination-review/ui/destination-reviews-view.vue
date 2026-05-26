<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useDestinationReviews } from '../composables/use-destination-reviews'
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
  countries,
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
  openCreateModal,
  openEditModal,
  submitReview,
  submitEditReview,
  deleteReview,
} = useDestinationReviews(props.userId)

onMounted(() => {
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
        Добавить
      </KitBtn>
    </div>

    <AsyncStateWrapper :loading="areReviewsLoading" :data="filteredReviews.length > 0 ? filteredReviews : null">
      <template #loading>
        <div class="reviews-grid">
          <DestinationReviewCardSkeleton v-for="n in 4" :key="n" />
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
      </template>

      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:map-search-outline" />
          <p>Пока нет добавленных впечатлений.</p>
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
  gap: 24px;
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

.reviews-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--fg-tertiary-color);
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  border: 1px dashed var(--border-secondary-color);

  .iconify {
    font-size: 3rem;
    margin-bottom: 12px;
  }
}
</style>
