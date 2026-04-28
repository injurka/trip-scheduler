import type { Country, DestinationReview } from '~/shared/types/models/destination-review'
import { computed, ref } from 'vue'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'

export enum EDestinationReviewKeys {
  FETCH_COUNTRIES = 'destination-reviews:fetch-countries',
  FETCH_REVIEWS = 'destination-reviews:fetch-reviews',
  DELETE_REVIEW = 'destination-reviews:delete-review',
}

export function useDestinationReviews(userId: string) {
  const toast = useToast()
  const confirm = useConfirm()

  const reviews = ref<DestinationReview[]>([])
  const countries = ref<Country[]>([])
  const activeTab = ref<'city' | 'country'>('city')

  const areReviewsLoading = useRequestStatus([
    EDestinationReviewKeys.FETCH_REVIEWS,
  ])
  const areCountriesLoading = useRequestStatus([
    EDestinationReviewKeys.FETCH_COUNTRIES,
  ])

  const filteredReviews = computed(() => {
    return reviews.value.filter(r => r.type === activeTab.value)
  })

  async function fetchCountries() {
    if (countries.value.length > 0)
      return

    await useRequest({
      key: EDestinationReviewKeys.FETCH_COUNTRIES,
      fn: db => db.destinationReviews.getCountries(),
      onSuccess: (data) => {
        countries.value = data
      },
    })
  }

  async function fetchReviews() {
    await useRequest({
      key: EDestinationReviewKeys.FETCH_REVIEWS,
      fn: db => db.destinationReviews.getUserReviews({ userId }),
      onSuccess: (data) => {
        reviews.value = data
      },
    })
  }

  async function deleteReview(id: string) {
    const isConfirmed = await confirm({
      title: 'Удалить впечатление?',
      description: 'Это действие нельзя будет отменить. Ваши оценки и отзыв будут удалены.',
      type: 'danger',
      confirmText: 'Да, удалить',
    })

    if (!isConfirmed)
      return

    await useRequest({
      key: EDestinationReviewKeys.DELETE_REVIEW,
      fn: db => db.destinationReviews.delete({ id }),
      onSuccess: () => {
        reviews.value = reviews.value.filter(r => r.id !== id)
        toast.success('Впечатление удалено')
      },
      onError: ({ error }) => {
        toast.error(error.customMessage || 'Ошибка удаления')
      },
    })
  }

  return {
    activeTab,
    reviews,
    filteredReviews,
    countries,
    areReviewsLoading,
    areCountriesLoading,
    fetchCountries,
    fetchReviews,
    deleteReview,
  }
}
