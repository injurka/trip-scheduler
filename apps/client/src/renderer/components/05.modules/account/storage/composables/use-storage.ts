import type { TripImage } from '~/shared/types/models/trip'
import { computed, reactive, ref, watch } from 'vue'
import { useRequest, useRequestError, useRequestStatus } from '~/plugins/request'
import { useQuerySync } from '~/shared/composables/use-query-sync'
import { useAuthStore } from '~/shared/store/auth.store'
import { TripImagePlacement } from '~/shared/types/models/trip'

interface SimpleTrip {
  id: string
  title: string
}

export interface TripImageWithTrip extends TripImage {
  trip?: SimpleTrip
}

export enum EStorageKeys {
  FETCH_FILES = 'storage:fetch-files',
  DELETE_FILE = 'storage:delete-file',
}

export function useStorageModule() {
  const authStore = useAuthStore()
  const toast = useToast()

  const files = ref<TripImageWithTrip[]>([])

  const search = useQuerySync('search', '')
  const tripId = useQuerySync<string | null>('tripId', '')
  const sizeMin = useQuerySync<number | null>('sizeMin', null)
  const sizeMax = useQuerySync<number | null>('sizeMax', null)
  const extension = useQuerySync<string | null>('extension', '')
  const placement = useQuerySync<TripImagePlacement | ''>('placement', '')

  // Реактивный прокси для v-model в UI
  const filters = reactive({
    search,
    tripId,
    sizeMin,
    sizeMax,
    extension,
    placement,
  })

  const sortKey = useQuerySync<keyof TripImageWithTrip | 'trip.title' | 'placement'>('sortKey', 'createdAt')
  const sortOrder = useQuerySync<'asc' | 'desc'>('sortOrder', 'desc')

  const sortBy = reactive({
    key: sortKey,
    order: sortOrder,
  })

  const viewMode = useQuerySync<'grid' | 'list'>('view', 'grid')
  const activeChart = useQuerySync<'byTrip' | 'byPlacement'>('chart', 'byTrip')

  const currentPage = useQuerySync('page', 1)
  const itemsPerPage = useQuerySync('limit', 24)

  const isLoading = useRequestStatus(EStorageKeys.FETCH_FILES)
  const error = useRequestError(EStorageKeys.FETCH_FILES)

  const fetchFiles = async () => {
    await useRequest({
      key: EStorageKeys.FETCH_FILES,
      fn: db => db.files.getAllUserFiles(),
      onSuccess: (data) => {
        files.value = data as TripImageWithTrip[]
      },
    })
  }

  const deleteFile = async (fileId: string) => {
    const originalFiles = [...files.value]
    const fileToDelete = files.value.find(f => f.id === fileId)

    files.value = files.value.filter(f => f.id !== fileId)

    await useRequest({
      key: `${EStorageKeys.DELETE_FILE}:${fileId}`,
      fn: db => db.files.deleteFile(fileId),
      onSuccess: () => {
        toast.success('Файл успешно удален.')
        if (fileToDelete?.sizeBytes) {
          authStore.decrementStorageUsage(fileToDelete.sizeBytes)
        }
      },
      onError: (e) => {
        toast.error('Не удалось удалить файл.')
        files.value = originalFiles
        console.error(e)
      },
    })
  }

  function setSort(key: keyof TripImageWithTrip | 'trip.title' | 'placement') {
    if (sortBy.key === key) {
      sortBy.order = sortBy.order === 'asc' ? 'desc' : 'asc'
    }
    else {
      sortBy.key = key
      sortBy.order = 'desc'
    }
  }

  const filteredAndSortedFiles = computed(() => {
    let result = [...files.value]

    if (filters.search) {
      const s = filters.search.toLowerCase()
      result = result.filter(f => f.originalName?.toLowerCase().includes(s))
    }
    if (filters.tripId) {
      if (filters.tripId === 'no-trip') {
        result = result.filter(f => !f.trip)
      }
      else {
        result = result.filter(f => f.trip?.id === filters.tripId)
      }
    }
    if (filters.extension) {
      result = result.filter(f => f.originalName?.toLowerCase().endsWith(`.${filters.extension}`))
    }
    if (filters.placement) {
      result = result.filter(f => f.placement === filters.placement)
    }
    if (filters.sizeMin !== null && filters.sizeMin >= 0) {
      const minBytes = filters.sizeMin * 1024 * 1024
      result = result.filter(f => f.sizeBytes >= minBytes)
    }
    if (filters.sizeMax !== null && filters.sizeMax >= 0) {
      const maxBytes = filters.sizeMax * 1024 * 1024
      result = result.filter(f => f.sizeBytes <= maxBytes)
    }

    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      if (sortBy.key === 'trip.title') {
        aVal = a.trip?.title || ''
        bVal = b.trip?.title || ''
      }
      else {
        aVal = a[sortBy.key as keyof TripImageWithTrip]
        bVal = b[sortBy.key as keyof TripImageWithTrip]
      }

      const order = sortBy.order === 'asc' ? 1 : -1

      if (aVal === null || aVal === undefined)
        return 1 * order
      if (bVal === null || bVal === undefined)
        return -1 * order

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * order
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, undefined, { numeric: true }) * order
      }
      if (sortBy.key === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order
      }

      return 0
    })

    return result
  })

  const paginatedFiles = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredAndSortedFiles.value.slice(start, end)
  })

  watch([filters, sortBy], () => {
    currentPage.value = 1
  }, { deep: true })

  const totalStorageUsed = computed(() => {
    return files.value.reduce((acc, file) => acc + (file.sizeBytes || 0), 0)
  })

  const tripsForFilter = computed(() => {
    const tripsMap = new Map<string, string>()
    let hasFilesWithoutTrip = false
    files.value.forEach((file) => {
      if (file.trip) {
        tripsMap.set(file.trip.id, file.trip.title)
      }
      else {
        hasFilesWithoutTrip = true
      }
    })
    const tripOptions = Array.from(tripsMap.entries()).map(([id, title]) => ({ value: id, label: title }))
    if (hasFilesWithoutTrip) {
      tripOptions.push({ value: 'no-trip', label: 'Без путешествия' })
    }

    return [{ value: '', label: 'Все путешествия' }, ...tripOptions]
  })

  const fileExtensionsForFilter = computed(() => {
    const extensions = new Set<string>()
    files.value.forEach((file) => {
      const name = file.originalName || ''
      const parts = name.split('.')
      if (parts.length > 1) {
        extensions.add(parts.pop()!.toLowerCase())
      }
    })
    const extOptions = Array.from(extensions).sort().map(ext => ({ value: ext, label: `.${ext}` }))
    return [{ value: '', label: 'Все расширения' }, ...extOptions]
  })

  const placementsForFilter = [
    { value: '', label: 'Все секции' },
    { value: TripImagePlacement.MEMORIES, label: 'Воспоминания' },
    { value: TripImagePlacement.ROUTE, label: 'Маршрут' },
  ]

  const storageByTrip = computed(() => {
    const tripStorage: Record<string, { name: string, size: number }> = {}
    files.value.forEach((file) => {
      const tripId = file.trip?.id || 'no-trip'
      const tripName = file.trip?.title || 'Без путешествия'
      if (!tripStorage[tripId]) {
        tripStorage[tripId] = { name: tripName, size: 0 }
      }
      tripStorage[tripId].size += file.sizeBytes || 0
    })

    const sortedTrips = Object.values(tripStorage).sort((a, b) => b.size - a.size)

    const labels = sortedTrips.map(t => t.name)
    const data = sortedTrips.map(t => t.size)

    const backgroundColors = [
      '#4A90E2',
      '#50E3C2',
      '#F5A623',
      '#F8E71C',
      '#BD10E0',
      '#9013FE',
      '#B8E986',
      '#7ED321',
      '#E6194B',
      '#4363D8',
      '#FABEBE',
      '#008080',
    ]

    return {
      labels,
      datasets: [{
        label: 'Размер файлов',
        data,
        backgroundColor: labels.map((_, i) => backgroundColors[i % backgroundColors.length]),
      }],
    }
  })

  const storageByPlacement = computed(() => {
    const placementStorage: Record<string, number> = {
      [TripImagePlacement.MEMORIES]: 0,
      [TripImagePlacement.ROUTE]: 0,
    }
    files.value.forEach((file) => {
      if (file.placement && placementStorage[file.placement] !== undefined) {
        placementStorage[file.placement] += file.sizeBytes || 0
      }
    })

    const data = [
      placementStorage[TripImagePlacement.MEMORIES],
      placementStorage[TripImagePlacement.ROUTE],
    ]
    const labels = ['Воспоминания', 'Маршрут']
    const backgroundColors = ['#4A90E2', '#50E3C2']

    return {
      labels,
      datasets: [{
        label: 'Размер файлов',
        data,
        backgroundColor: backgroundColors,
      }],
    }
  })

  return {
    files,
    filters,
    sortBy,
    viewMode,
    isLoading,
    error,
    fetchFiles,
    deleteFile,
    setSort,
    filteredAndSortedFiles,
    totalStorageUsed,
    tripsForFilter,
    fileExtensionsForFilter,
    placementsForFilter,
    storageByTrip,
    storageByPlacement,
    activeChart,
    currentPage,
    itemsPerPage,
    paginatedFiles,
  }
}
