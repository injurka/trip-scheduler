<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useDestinationReviews } from '../composables/use-destination-reviews'
import DestinationReviewCard from './components/destination-review-card.vue'
import DestinationReviewForm from './components/destination-review-form.vue'

const props = defineProps<{ userId: string, isOwnProfile: boolean }>()

const {
  activeTab,
  filteredReviews,
  countries,
  areReviewsLoading,
  areCountriesLoading,
  fetchCountries,
  fetchReviews,
  deleteReview,
} = useDestinationReviews(props.userId)

const isFormOpen = ref(false)

const tabs = [
  { id: 'city', label: 'Города', icon: 'mdi:city-variant-outline' },
  { id: 'country', label: 'Страны', icon: 'mdi:earth' },
]

async function openAddReviewForm() {
  await fetchCountries()
  isFormOpen.value = true
}

onMounted(() => {
  fetchReviews()
})
</script>

<template>
  <div class="reviews-view">
    <div class="toolbar">
      <KitViewSwitcher v-model="activeTab" :items="tabs" />
      <div style="flex-grow: 1" />
      <KitBtn
        v-if="isOwnProfile"
        size="sm"
        icon="mdi:plus"
        :loading="areCountriesLoading"
        @click="openAddReviewForm"
      >
        Добавить
      </KitBtn>
    </div>

    <AsyncStateWrapper :loading="areReviewsLoading" :data="filteredReviews.length > 0 ? filteredReviews : null">
      <template #success="{ data }">
        <div class="reviews-grid">
          <DestinationReviewCard
            v-for="review in data"
            :key="review.id"
            :review="review"
            @delete="deleteReview"
          />
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:map-search-outline" />
          <p>Пока нет добавленных впечатлений в этой категории.</p>
        </div>
      </template>
    </AsyncStateWrapper>

    <DestinationReviewForm
      v-model:visible="isFormOpen"
      :countries="countries"
      @success="fetchReviews"
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
}

.reviews-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
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
