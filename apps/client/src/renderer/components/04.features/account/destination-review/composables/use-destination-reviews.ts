import type { Country, DestinationReview } from '~/shared/types/models/destination-review'
import { computed, reactive, ref, watch } from 'vue'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

export enum EDestinationReviewKeys {
  FETCH_COUNTRIES = 'destination-reviews:fetch-countries',
  FETCH_REVIEWS = 'destination-reviews:fetch-reviews',
  CREATE_REVIEW = 'destination-reviews:create',
  UPDATE_REVIEW = 'destination-reviews:update',
  DELETE_REVIEW = 'destination-reviews:delete',
  UPLOAD_COVER = 'destination-reviews:upload-cover',
}

export type DestinationMetricKey = 'safety' | 'culture' | 'infrastructure' | 'food' | 'prices' | 'nature' | 'vibe' | 'climate' | 'people' | 'entertainment'

export const METRIC_KEYS: DestinationMetricKey[] = ['safety', 'culture', 'infrastructure', 'food', 'prices', 'nature', 'vibe', 'climate', 'people', 'entertainment']

export const METRIC_LABELS: Record<DestinationMetricKey, string> = {
  safety: 'Безопасность',
  culture: 'Культура',
  infrastructure: 'Инфраструктура',
  food: 'Еда',
  prices: 'Цены',
  nature: 'Природа',
  vibe: 'Атмосфера',
  climate: 'Климат',
  people: 'Люди',
  entertainment: 'Развлечения',
}

interface ReviewFormState {
  type: 'city'
  countryId: string
  city: string
  coverUrl: string | null
  latitude: number | string
  longitude: number | string
  content: string
  metrics: Record<string, number>
  metricComments: Record<string, string>
}

function createEmptyForm(): ReviewFormState {
  return {
    type: 'city',
    countryId: '',
    city: '',
    coverUrl: null,
    latitude: '',
    longitude: '',
    content: '',
    metrics: { safety: 3, culture: 3, infrastructure: 3, food: 3, prices: 3, nature: 3, vibe: 3, climate: 3, people: 3, entertainment: 3 },
    metricComments: {},
  }
}

export function useDestinationReviews(userId: string) {
  const authStore = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()

  const reviews = ref<DestinationReview[]>([])
  const countries = ref<Country[]>([])

  const isCreateModalOpen = ref(false)
  const isEditModalOpen = ref(false)
  const editingReview = ref<DestinationReview | null>(null)

  const areReviewsLoading = useRequestStatus([EDestinationReviewKeys.FETCH_REVIEWS])
  const areCountriesLoading = useRequestStatus([EDestinationReviewKeys.FETCH_COUNTRIES])
  const isSubmitting = useRequestStatus([EDestinationReviewKeys.CREATE_REVIEW, EDestinationReviewKeys.UPDATE_REVIEW])
  const isUploading = useRequestStatus([EDestinationReviewKeys.UPLOAD_COVER])

  const form = reactive<ReviewFormState>(createEmptyForm())
  const editForm = reactive<ReviewFormState>(createEmptyForm())

  const formFile = ref<File | null>(null)
  const editFormFile = ref<File | null>(null)

  const filteredReviews = computed(() => {
    return reviews.value
  })

  async function fetchCountries() {
    if (countries.value.length > 0)
      return
    await useRequest({
      key: EDestinationReviewKeys.FETCH_COUNTRIES,
      fn: db => db.destinationReviews.getCountries(),
      onSuccess: (data) => { countries.value = data },
    })
  }

  async function fetchReviews() {
    await useRequest({
      key: EDestinationReviewKeys.FETCH_REVIEWS,
      fn: db => db.destinationReviews.getUserReviews({ userId }),
      onSuccess: (data) => { reviews.value = data },
    })
  }

  function resetCreateForm() {
    Object.assign(form, createEmptyForm())
    formFile.value = null
  }

  function resetEditForm() {
    Object.assign(editForm, createEmptyForm())
    editFormFile.value = null
    editingReview.value = null
  }

  async function openCreateModal() {
    resetCreateForm()
    await fetchCountries()
    isCreateModalOpen.value = true
  }

  async function openEditModal(review: DestinationReview) {
    await fetchCountries()
    editingReview.value = review

    const extractedMetrics = {} as Record<DestinationMetricKey, number>
    const extractedComments = {} as Record<DestinationMetricKey, string>

    if (review.metrics) {
      for (const [key, value] of Object.entries(review.metrics)) {
        if (key.endsWith('_comment') && typeof value === 'string') {
          extractedComments[key.replace('_comment', '') as DestinationMetricKey] = value
        }
        else if (typeof value === 'number') {
          extractedMetrics[key as DestinationMetricKey] = value
        }
      }
    }

    Object.assign(editForm, {
      type: 'city',
      countryId: review.country?.id || '',
      city: review.city || '',
      coverUrl: review.coverUrl || null,
      latitude: review.latitude ?? '',
      longitude: review.longitude ?? '',
      content: review.content || '',
      metrics: { ...createEmptyForm().metrics, ...extractedMetrics },
      metricComments: { ...extractedComments, ...(review as any).metricComments },
    })

    editFormFile.value = null
    isEditModalOpen.value = true
  }

  async function uploadCoverImage(file: File): Promise<string | null> {
    if (!authStore.user?.id)
      return null
    let uploadedUrl: string | null = null

    await useRequest({
      key: EDestinationReviewKeys.UPLOAD_COVER,
      fn: db => db.files.uploadFile(file, authStore.user!.id, 'review', 'cover'),
      onSuccess: (uploadedImage) => { uploadedUrl = uploadedImage.url },
      onError: ({ error }) => { toast.error(error.customMessage || 'Ошибка загрузки обложки') },
    })

    return uploadedUrl
  }

  function normalizePayload(source: ReviewFormState, coverUrl: string | null) {
    const combinedMetrics: Record<string, any> = { ...source.metrics }
    for (const [key, val] of Object.entries(source.metricComments || {})) {
      if (val) {
        combinedMetrics[`${key}_comment`] = val
      }
    }

    return {
      type: source.type,
      countryId: source.countryId,
      city: source.city,
      coverUrl,
      latitude: Number(source.latitude),
      longitude: Number(source.longitude),
      content: source.content || null,
      metrics: combinedMetrics,
    }
  }

  async function submitReview() {
    let finalCoverUrl = form.coverUrl
    if (formFile.value) {
      const uploaded = await uploadCoverImage(formFile.value)
      if (uploaded)
        finalCoverUrl = uploaded
    }

    await useRequest({
      key: EDestinationReviewKeys.CREATE_REVIEW,
      fn: db => db.destinationReviews.create(normalizePayload(form, finalCoverUrl) as any),
      onSuccess: () => {
        toast.success('Впечатление добавлено!')
        isCreateModalOpen.value = false
        fetchReviews()
      },
      onError: ({ error }) => { toast.error(error.customMessage || 'Ошибка при сохранении') },
    })
  }

  async function submitEditReview() {
    if (!editingReview.value)
      return

    let finalCoverUrl = editForm.coverUrl
    if (editFormFile.value) {
      const uploaded = await uploadCoverImage(editFormFile.value)
      if (uploaded)
        finalCoverUrl = uploaded
    }

    await useRequest({
      key: EDestinationReviewKeys.UPDATE_REVIEW,
      fn: db => db.destinationReviews.update({ id: editingReview.value!.id, ...normalizePayload(editForm, finalCoverUrl) }),
      onSuccess: () => {
        toast.success('Изменения сохранены!')
        isEditModalOpen.value = false
        fetchReviews()
      },
      onError: ({ error }) => { toast.error(error.customMessage || 'Ошибка при обновлении') },
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

  watch(isCreateModalOpen, (val) => {
    if (!val)
      setTimeout(resetCreateForm, 300)
  })
  watch(isEditModalOpen, (val) => {
    if (!val)
      setTimeout(resetEditForm, 300)
  })

  return {
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
    fetchCountries,
    fetchReviews,
    openCreateModal,
    openEditModal,
    submitReview,
    submitEditReview,
    deleteReview,
  }
}
