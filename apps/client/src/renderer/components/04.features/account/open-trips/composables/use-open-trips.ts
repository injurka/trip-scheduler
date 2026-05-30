import type { Trip, TripStatus } from '~/shared/types/models/trip'
import { useDebounce } from '@vueuse/core'
import { useRequest, useRequestError, useRequestStatus } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'

export interface OpenTripFilters {
  search: string
  cities: string[]
  tags: string[]
  status: TripStatus[]
}

export function useOpenTrips(userId: string) {
  const toast = useToast()

  const trips = ref<Trip[]>([])
  const hasLoadedOnce = ref(false)

  const filters = ref<OpenTripFilters>({
    search: '',
    cities: [],
    tags: [],
    status: [],
  })

  const availableCities = ref<{ value: string, label: string }[]>([])
  const availableTags = ref<{ value: string, label: string }[]>([])
  const tagSearchQuery = ref('')

  const debouncedTagSearchQuery = useDebounce(tagSearchQuery, 300)
  const debouncedFilters = useDebounce(filters, 400)

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

  async function fetchAvailableCities() {
    if (availableCities.value.length > 0)
      return

    await useRequest({
      key: 'account:fetch-cities',
      fn: db => db.trips.getUniqueCities(),
      onSuccess: (cities) => {
        availableCities.value = cities.map(city => ({ value: city, label: city }))
      },
      onError: ({ error }) => {
        toast.error(`Не удалось загрузить города: ${error.customMessage}`)
      },
    })
  }

  async function fetchTrips() {
    const apiFilters = {
      tab: 'public' as const,
      userIds: [userId],
      search: filters.value.search || undefined,
      cities: filters.value.cities.length > 0 ? filters.value.cities : undefined,
      tags: filters.value.tags.length > 0 ? filters.value.tags : undefined,
      statuses: filters.value.status.length > 0 ? filters.value.status : undefined,
    }

    await useRequest({
      key: 'account:fetch-open-trips',
      cancelPrevious: true,
      fn: db => db.trips.getAll(apiFilters),
      onSuccess: (result) => {
        trips.value = result.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )
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
    availableCities,
    availableTags,
    tagSearchQuery,
    isLoading,
    fetchError,
    hasLoadedOnce,
    fetchTrips,
    fetchAvailableCities,
    searchTags,
  }
}
