import type { Ref } from 'vue'
import type {
  DocumentCategory,
  DocumentFile,
  DocumentSortOption,
  DocumentViewMode,
} from '../models/types'
import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { DOCUMENT_CATEGORIES } from '../constants'

export interface SortOptionItem {
  id: DocumentSortOption
  label: string
  icon: string
}

export const DOCUMENT_SORT_OPTIONS: SortOptionItem[] = [
  { id: 'date_desc', label: 'Сначала новые', icon: 'mdi:sort-clock-descending-outline' },
  { id: 'date_asc', label: 'Сначала старые', icon: 'mdi:sort-clock-ascending-outline' },
  { id: 'name_asc', label: 'По названию (А — Я)', icon: 'mdi:sort-alphabetical-ascending' },
  { id: 'name_desc', label: 'По названию (Я — А)', icon: 'mdi:sort-alphabetical-descending' },
  { id: 'size_desc', label: 'Сначала большие', icon: 'mdi:sort-numeric-descending' },
  { id: 'size_asc', label: 'Сначала компактные', icon: 'mdi:sort-numeric-ascending' },
]

function matchesSearch(document: DocumentFile, query: string): boolean {
  return Boolean(document.title?.toLowerCase().includes(query))
    || document.originalName.toLowerCase().includes(query)
    || Boolean(document.note?.toLowerCase().includes(query))
}

function compareDocumentNames(a: DocumentFile, b: DocumentFile, ascending: boolean): number {
  const nameA = (a.title || a.originalName).toLowerCase()
  const nameB = (b.title || b.originalName).toLowerCase()
  const comparison = nameA.localeCompare(nameB)

  return ascending ? comparison : -comparison
}

function compareDocuments(a: DocumentFile, b: DocumentFile, sortOption: DocumentSortOption): number {
  if (sortOption === 'date_desc' && a.isFavorite !== b.isFavorite)
    return a.isFavorite ? -1 : 1

  if (sortOption === 'name_asc' || sortOption === 'name_desc')
    return compareDocumentNames(a, b, sortOption === 'name_asc')

  if (sortOption === 'size_desc')
    return b.sizeBytes - a.sizeBytes

  if (sortOption === 'size_asc')
    return a.sizeBytes - b.sizeBytes

  const direction = sortOption === 'date_asc' ? 1 : -1

  return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
}

export function useDocumentFilters(documents: Ref<DocumentFile[]>, currentFolderId: Ref<string | null>) {
  const searchQuery = ref('')
  const selectedCategory = ref<DocumentCategory>('all')
  const onlyFavorites = ref(false)
  const sortOption = ref<DocumentSortOption>('date_desc')
  const viewMode = useStorage<DocumentViewMode>('documents_view_mode', 'grid')

  const currentSortLabel = computed(() => {
    return DOCUMENT_SORT_OPTIONS.find(o => o.id === sortOption.value)?.label || 'Сортировка'
  })

  // Количество документов в каждой категории (с учетом папки, если она открыта)
  const categoryCounts = computed(() => {
    const map = new Map<DocumentCategory, number>()
    const relevantDocs = searchQuery.value.trim() || !currentFolderId.value
      ? documents.value
      : documents.value.filter(d => d.folderId === currentFolderId.value)

    DOCUMENT_CATEGORIES.forEach((cat) => {
      map.set(cat.id, relevantDocs.filter(d => d.category === cat.id).length)
    })

    return map
  })

  // Отфильтрованные и отсортированные документы
  const filteredDocuments = computed(() => {
    let list = documents.value

    // В корне показываем все документы поездки; выбранная папка ограничивает список.
    if (!searchQuery.value.trim() && currentFolderId.value) {
      list = list.filter(d => d.folderId === currentFolderId.value)
    }

    // Фильтр по поисковой строке
    if (searchQuery.value.trim())
      list = list.filter(d => matchesSearch(d, searchQuery.value.toLowerCase().trim()))

    // Фильтр по категории
    if (selectedCategory.value !== 'all') {
      list = list.filter(d => d.category === selectedCategory.value)
    }

    // Фильтр по избранному
    if (onlyFavorites.value) {
      list = list.filter(d => d.isFavorite)
    }

    // Сортировка
    return [...list].sort((a, b) => compareDocuments(a, b, sortOption.value))
  })

  function resetFilters() {
    searchQuery.value = ''
    selectedCategory.value = 'all'
    onlyFavorites.value = false
  }

  return {
    searchQuery,
    selectedCategory,
    onlyFavorites,
    sortOption,
    viewMode,
    sortOptions: DOCUMENT_SORT_OPTIONS,
    currentSortLabel,
    categoryCounts,
    filteredDocuments,
    resetFilters,
  }
}
