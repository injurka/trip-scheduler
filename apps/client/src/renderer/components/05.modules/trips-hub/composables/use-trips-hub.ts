import type { InjectionKey } from 'vue'
import type { ITrip } from '../models/types'
import type { UpdateTripInput } from '~/shared/types/models/trip'
import { useDebounce } from '@vueuse/core'
import { useAbortRequest, useRequest, useRequestError, useRequestStatus } from '~/plugins/request'
import { useLastCounts } from '~/shared/composables/use-last-counts'
import { TripStatus, TripVisibility } from '~/shared/types/models/trip'

export type TripsHubTab = 'my' | 'public'
export type TDisplayMode = 'column' | 'row'

export interface TripFilters {
  search: string
  cities: string[]
  users: string[]
  tags: string[]
  status: TripStatus[]
}

enum ETripHubKeys {
  FETCH_ALL = 'trips:fetch-all',
  FETCH_CITIES = 'trips:fetch-cities',
  FETCH_TAGS = 'trips:fetch-tags',
  CREATE = 'trips:create',
  UPDATE = 'trips:update',
  DELETE = 'trips:delete',
}

function getDefaultTripData() {
  return {
    title: '',
    description: '',
    startDate: new Date().toISOString(),
    cities: [],
    status: TripStatus.PLANNED,
    visibility: TripVisibility.PRIVATE,
  }
}

export function useTripsHub() {
  const { setCount } = useLastCounts()
  const { abort } = useAbortRequest()
  const authStore = useAppStore('auth')

  // State
  const trips = ref<ITrip[]>([])
  const isInitialized = ref(false)
  const hasLoadedOnce = ref(false)
  const isFiltersOpen = ref(false)
  const activeTab = ref<TripsHubTab>('my')
  const isCreateModalOpen = ref(false)
  const newTripData = ref(getDefaultTripData())
  const displayMode = ref<TDisplayMode>('row')
  const filters = ref<TripFilters>({
    search: '',
    cities: [],
    users: [],
    tags: [],
    status: [],
  })
  const availableCities = ref<{ value: string, label: string }[]>([])

  const availableTags = ref<{ value: string, label: string }[]>([])
  const tagSearchQuery = ref('')

  const debouncedTagSearchQuery = useDebounce(tagSearchQuery, 300)
  const debouncedFilters = useDebounce(filters, 400)

  // Computed (getters)
  const isLoading = computed(() => useRequestStatus(ETripHubKeys.FETCH_ALL).value)
  const isCreating = computed(() => useRequestStatus(ETripHubKeys.CREATE).value)
  const fetchError = computed(() => useRequestError(ETripHubKeys.FETCH_ALL).value)

  const currentTrips = computed((): ITrip[] => {
    return trips.value
  })

  async function searchTags(query?: string) {
    await useRequest({
      key: `${ETripHubKeys.FETCH_TAGS}:${query || ''}`,
      fn: db => db.trips.getUniqueTags({ query }),
      onSuccess: (tags) => {
        availableTags.value = tags.map(tag => ({ value: tag, label: tag }))
      },
      onError: (error) => {
        useToast().error(`Не удалось загрузить список тегов: ${error}`)
      },
    })
  }

  async function fetchAvailableCities() {
    if (availableCities.value.length > 0)
      return

    await useRequest({
      key: ETripHubKeys.FETCH_CITIES,
      fn: db => db.trips.getUniqueCities(),
      onSuccess: (cities) => {
        availableCities.value = cities.map(city => ({ value: city, label: city }))
      },
      onError: (error) => {
        useToast().error(`Не удалось загрузить список городов: ${error}`)
      },
    })
  }

  async function fetchTrips(force = false) {
    if (isInitialized.value && !force) {
      return
    }

    const apiFilters = {
      tab: activeTab.value,
      search: filters.value.search || undefined,
      cities: filters.value.cities.length > 0 ? filters.value.cities : undefined,
      tags: filters.value.tags.length > 0 ? filters.value.tags : undefined,
      statuses: filters.value.status.length > 0 ? filters.value.status : undefined,
      userIds: filters.value.users.length > 0 ? filters.value.users : undefined,
    }

    await useRequest({
      force,
      cache: !Object.values(apiFilters).some(v => v !== undefined),
      key: ETripHubKeys.FETCH_ALL,
      fn: db => db.trips.getAll(apiFilters),
      cancelPrevious: true,
      onSuccess: (result) => {
        trips.value = result.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )
        isInitialized.value = true
        hasLoadedOnce.value = true
        setCount('trip-list', trips.value.length)
      },
      onError: (error) => {
        trips.value = []
        useToast().error(`Не удалось загрузить список путешествий: ${error}`)
      },
    })
  }

  async function createTrip() {
    if (!authStore.canCreateTrip) {
      useToast().error('Вы достигли лимита на создание путешествий.')
      return
    }

    const toast = useToast()

    const newTrip = await useRequest({
      key: ETripHubKeys.CREATE,
      fn: db => db.trips.create(newTripData.value),
      onSuccess: (createdTrip) => {
        trips.value.unshift(createdTrip)
        authStore.incrementTripCount()
        toast.success(`Путешествие "${createdTrip.title}" создано!`)
        closeCreateModal()
      },
      onError: (error) => {
        toast.error(`Ошибка при создании путешествия: ${error}`)
      },
    })

    return newTrip
  }

  function deleteTrip(tripId: string) {
    const toast = useToast()
    const tripIndex = trips.value.findIndex(t => t.id === tripId)
    if (tripIndex === -1)
      return

    const [removedTrip] = trips.value.splice(tripIndex, 1)
    toast.info(`Путешествие "${removedTrip.title}" удалено.`)

    useRequest({
      key: `${ETripHubKeys.DELETE}:${tripId}`,
      fn: db => db.trips.delete(tripId),
      onSuccess: () => {
        authStore.decrementTripCount()
      },
      onError: (error) => {
        trips.value.splice(tripIndex, 0, removedTrip)
        toast.error(`Не удалось удалить путешествие: ${error}`)
      },
    })
  }

  function updateTripInList(updatedData: UpdateTripInput & { id: string }) {
    const tripIndex = trips.value.findIndex(t => t.id === updatedData.id)
    if (tripIndex === -1)
      return

    const originalTrip = { ...trips.value[tripIndex] }
    // Оптимистичное обновление
    trips.value[tripIndex] = { ...originalTrip, ...updatedData }

    useRequest({
      key: `${ETripHubKeys.UPDATE}:${updatedData.id}`,
      fn: db => db.trips.update(updatedData.id, updatedData),
      onSuccess: (updatedFromServer) => {
        const finalIndex = trips.value.findIndex(t => t.id === updatedData.id)
        if (finalIndex !== -1) {
          trips.value[finalIndex] = { ...trips.value[finalIndex], ...updatedFromServer }
        }
        useToast().success('Путешествие обновлено.')
      },
      onError: (error) => {
        const revertIndex = trips.value.findIndex(t => t.id === updatedData.id)
        if (revertIndex !== -1) {
          trips.value[revertIndex] = originalTrip
        }
        useToast().error(`Не удалось обновить путешествие: ${error}`)
      },
    })
  }

  function setActiveTab(tab: TripsHubTab) {
    if (activeTab.value === tab)
      return

    activeTab.value = tab
    fetchTrips(true)
  }

  function setDisplayMode(mode: TDisplayMode) {
    displayMode.value = mode
  }

  function openCreateModal() {
    if (!authStore.canCreateTrip) {
      useToast().error('Вы достигли лимита на создание путешествий. Улучшите ваш план, чтобы создавать больше.')
      return
    }
    isCreateModalOpen.value = true
  }

  function closeCreateModal() {
    isCreateModalOpen.value = false
    setTimeout(() => {
      newTripData.value = getDefaultTripData()
    }, 300)
  }

  watch(debouncedFilters, () => {
    fetchTrips(true)
  }, { deep: true })

  watch(debouncedTagSearchQuery, (newQuery) => {
    searchTags(newQuery)
  })

  onUnmounted(() => {
    abort(ETripHubKeys.FETCH_ALL)
  })

  return {
    // State
    trips: readonly(trips),
    isInitialized: readonly(isInitialized),
    hasLoadedOnce: readonly(hasLoadedOnce),
    isFiltersOpen,
    activeTab,
    filters,
    isCreateModalOpen,
    availableCities,
    availableTags,
    tagSearchQuery,
    newTripData,
    displayMode,

    // Computed
    isLoading,
    isCreating,
    fetchError,
    currentTrips,

    // Actions
    fetchTrips,
    fetchAvailableCities,
    searchTags,
    createTrip,
    deleteTrip,
    updateTripInList,
    setActiveTab,
    setDisplayMode,
    openCreateModal,
    closeCreateModal,
  }
}

export type TripsHubComposable = ReturnType<typeof useTripsHub>
export const TripsHubKey: InjectionKey<TripsHubComposable> = Symbol('TripsHub')
