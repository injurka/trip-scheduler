import type { TripImage } from '~/shared/types/models/trip'
import { useRequest, useRequestError, useRequestStatus } from '~/plugins/request'
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
  const filters = ref({
    search: '',
    tripId: '' as string | null,
    sizeMin: null as number | null,
    sizeMax: null as number | null,
    extension: '' as string | null,
    placement: '' as TripImagePlacement | '',
  })

  const sortBy = ref({ key: 'createdAt' as keyof TripImageWithTrip | 'trip.title' | 'placement', order: 'desc' as 'asc' | 'desc' })
  const viewMode = ref<'grid' | 'list'>('grid')
  const activeChart = ref<'byTrip' | 'byPlacement'>('byTrip')

  const currentPage = ref(1)
  const itemsPerPage = ref(24)

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
    if (sortBy.value.key === key) {
      sortBy.value.order = sortBy.value.order === 'asc' ? 'desc' : 'asc'
    }
    else {
      sortBy.value.key = key
      sortBy.value.order = 'desc'
    }
  }

  const filteredAndSortedFiles = computed(() => {
    let result = [...files.value]

    // Фильтрация
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase()
      result = result.filter(f => f.originalName?.toLowerCase().includes(search))
    }
    if (filters.value.tripId) {
      if (filters.value.tripId === 'no-trip') {
        result = result.filter(f => !f.trip)
      }
      else {
        result = result.filter(f => f.trip?.id === filters.value.tripId)
      }
    }
    if (filters.value.extension) {
      result = result.filter(f => f.originalName?.toLowerCase().endsWith(`.${filters.value.extension}`))
    }
    if (filters.value.placement) {
      result = result.filter(f => f.placement === filters.value.placement)
    }
    if (filters.value.sizeMin !== null && filters.value.sizeMin >= 0) {
      const minBytes = filters.value.sizeMin * 1024 * 1024
      result = result.filter(f => f.sizeBytes >= minBytes)
    }
    if (filters.value.sizeMax !== null && filters.value.sizeMax >= 0) {
      const maxBytes = filters.value.sizeMax * 1024 * 1024
      result = result.filter(f => f.sizeBytes <= maxBytes)
    }

    // Сортировка
    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      if (sortBy.value.key === 'trip.title') {
        aVal = a.trip?.title || ''
        bVal = b.trip?.title || ''
      }
      else {
        aVal = a[sortBy.value.key as keyof TripImageWithTrip]
        bVal = b[sortBy.value.key as keyof TripImageWithTrip]
      }

      const order = sortBy.value.order === 'asc' ? 1 : -1

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
      if (sortBy.value.key === 'createdAt') {
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

  // Сбрасываем страницу при изменении фильтров
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
