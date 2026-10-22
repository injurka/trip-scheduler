import type { Trip, TripStatus } from '~/shared/types/models/trip'
import { refDebounced } from '@vueuse/core'
import { useRequest, useRequestError, useRequestStatus } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'

export interface OpenTripFilters {
  search: string
  cityIds: string[]
  tags: string[]
  status: TripStatus[]
}

export function useOpenTrips(userId: string) {
  const toast = useToast()

  const trips = ref<Trip[]>([])
  const hasLoadedOnce = ref(false)

  const filters = ref<OpenTripFilters>({
    search: '',
    cityIds: [],
    tags: [],
    status: [],
  })

  const availableTags = ref<{ value: string, label: string }[]>([])
  const tagSearchQuery = ref('')

  const debouncedTagSearchQuery = refDebounced(tagSearchQuery, 300)
  const debouncedFilters = refDebounced(filters, 400)

  const isLoading = useRequestStatus(['account:fetch-open-trips'])
  const fetchError = useRequestError(['account:fetch-open-trips'])

  async function searchTags(query?: string) {
    await useRequest({
      key: `account:fetch-tags:${query || ''}`,
      fn: db => db.trips.getUniqueTags({ query }),
      onSuccess: (tags) => {
        availableTags.value = tags.map(tag => ({ value: tag, label: tag }))
      },
      onError: ({ error }) => {
        toast.error(`Не удалось загрузить теги: ${error.customMessage}`)
      },
    })
  }

  async function fetchTrips() {
    const apiFilters = {
      tab: 'public' as const,
      userIds: [userId],
      search: filters.value.search || undefined,
      cityIds: filters.value.cityIds.length > 0 ? filters.value.cityIds : undefined,
      tags: filters.value.tags.length > 0 ? filters.value.tags : undefined,
      statuses: filters.value.status.length > 0 ? filters.value.status : undefined,
    }

    await useRequest({
      key: 'account:fetch-open-trips',
      cancelPrevious: true,
      fn: db => db.trips.getAll(apiFilters),
      onSuccess: (result) => {
        trips.value = result.sort((a, b) => {
          const diff = new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
          if (diff !== 0)
            return diff

          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        })
        hasLoadedOnce.value = true
      },
      onError: ({ error }) => {
        trips.value = []
        toast.error(`Не удалось загрузить путешествия: ${error.customMessage}`)
      },
    })
  }

  watch(debouncedFilters, () => {
    fetchTrips()
  }, { deep: true })

  watch(debouncedTagSearchQuery, (newQuery) => {
    searchTags(newQuery)
  })

  return {
    trips: readonly(trips),
    filters,
    availableTags,
    tagSearchQuery,
    isLoading,
    fetchError,
    hasLoadedOnce,
    fetchTrips,
    searchTags,
  }
}
