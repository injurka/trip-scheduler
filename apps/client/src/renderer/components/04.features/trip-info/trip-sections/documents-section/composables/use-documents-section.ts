import type {
  DocumentCategory,
  DocumentFile,
  DocumentsSectionContent,
} from '../models/types'
import type { TripDocumentResponse } from '~/shared/services/api/model/types'
import { computed, ref, watch } from 'vue'
import { useRequest } from '~/plugins/request'
import { isAppOnline } from '~/shared/lib/connectivity'
import { useOfflineStore } from '~/shared/store/offline.store'
import { useDocumentFilters } from './use-document-filters'
import { useDocumentFolders } from './use-document-folders'
import { useDocumentSelection } from './use-document-selection'
import { useDocumentUpload } from './use-document-upload'

interface UseDocumentsSectionProps {
  section: {
    id: string
    tripId: string
    type: 'documents'
    content: DocumentsSectionContent
  }
  readonly: boolean
}

export function useDocumentsSection(props: UseDocumentsSectionProps, emit: (event: 'updateSection', payload: unknown) => void) {
  const confirm = useConfirm()
  const toast = useToast()
  const offlineStore = useOfflineStore()

  const documents = ref<DocumentFile[]>([])
  const isFetching = ref(false)

  function mapResponseToDoc(d: TripDocumentResponse): DocumentFile {
    return {
      id: d.id,
      url: d.url,
      originalName: d.originalName,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
      access: d.metadata.access,
      folderId: d.metadata.folderId,
      title: d.metadata.title ?? null,
      category: (d.metadata.category as DocumentCategory) ?? null,
      isFavorite: Boolean(d.metadata.isFavorite),
      note: d.metadata.note ?? null,
      variants: d.variants || (d.metadata)?.variants || null,
    }
  }

  let loadSequence = 0
  async function loadDocuments() {
    const sequence = ++loadSequence
    const tripId = props.section.tripId
    isFetching.value = true

    if (!isAppOnline()) {
      if (offlineStore.isTripCached(tripId)) {
        const cachedDocs = offlineStore.getSavedTripDocuments(tripId)
        documents.value = cachedDocs.map(mapResponseToDoc)
      }
      else {
        documents.value = []
      }

      isFetching.value = false

      return
    }

    await useRequest({
      key: `documents:list:${tripId}`,
      fn: api => api.files.listDocuments(tripId),
      onSuccess: (res) => {
        if (sequence !== loadSequence)
          return

        documents.value = res.map(mapResponseToDoc)
      },
      onError: () => {
        if (sequence !== loadSequence)
          return

        const cachedDocs = offlineStore.getSavedTripDocuments(tripId)

        if (offlineStore.isTripCached(tripId)) {
          documents.value = cachedDocs.map(mapResponseToDoc)

          return
        }

        if (isAppOnline()) {
          toast.error('Не удалось загрузить документы')
        }
      },
    })

    if (sequence === loadSequence)
      isFetching.value = false
  }

  watch(() => props.section.tripId, () => {
    documents.value = []
    void loadDocuments()
  }, { immediate: true })

  // Базовые операции над отдельными документами
  async function updateDocument(updatedDoc: DocumentFile) {
    if (props.readonly)
      return

    const prev = documents.value.find(d => d.id === updatedDoc.id)
    const index = documents.value.findIndex(d => d.id === updatedDoc.id)

    if (index !== -1) {
      documents.value[index] = { ...updatedDoc }
    }

    await useRequest({
      key: `documents:update:${updatedDoc.id}`,
      fn: api =>
        api.files.updateDocumentMeta(updatedDoc.id, {
          folderId: updatedDoc.folderId,
          access: updatedDoc.access,
          title: updatedDoc.title,
          category: updatedDoc.category,
          isFavorite: updatedDoc.isFavorite,
          note: updatedDoc.note,
        }),
      onError: () => {
        if (prev && index !== -1) {
          documents.value[index] = prev
        }

        toast.error('Не удалось обновить документ')
      },
    })
  }

  async function deleteDocument(docId: string) {
    if (props.readonly)
      return

    const doc = documents.value.find(d => d.id === docId)
    const isConfirmed = await confirm({
      title: `Удалить «${doc?.title || doc?.originalName || 'документ'}»?`,
      description: 'Файл будет удален навсегда.',
      type: 'danger',
    })

    if (isConfirmed) {
      await useRequest({
        key: `documents:delete:${docId}`,
        fn: api => api.files.deleteFile(docId),
        onSuccess: () => {
          documents.value = documents.value.filter(d => d.id !== docId)
          toast.success('Документ удален')
        },
        onError: () => {
          toast.error('Не удалось удалить документ')
        },
      })
    }
  }

  async function toggleFavorite(doc: DocumentFile) {
    await updateDocument({
      ...doc,
      isFavorite: !doc.isFavorite,
    })
  }

  // Декомпозированные подсистемы
  const foldersModule = useDocumentFolders(
    props,
    emit,
    documents,
    ref(''),
    ref('all'),
    ref(false),
    updateDocument,
  )

  async function moveDocument(doc: DocumentFile, targetFolderId: string | null) {
    if (props.readonly || (targetFolderId && !foldersModule.folders.value.some(f => f.id === targetFolderId)))
      return

    if (doc.folderId === targetFolderId)
      return

    await updateDocument({
      ...doc,
      folderId: targetFolderId,
    })

    if (documents.value.find(d => d.id === doc.id)?.folderId !== targetFolderId)
      return

    const targetName = targetFolderId ? foldersModule.folders.value.find(f => f.id === targetFolderId)?.name : 'Корень'
    toast.success(`Перемещено в «${targetName || 'Все документы'}»`)
  }

  // Общая статистика
  const totalStats = computed(() => ({
    count: documents.value.length,
    sizeBytes: documents.value.reduce((acc, d) => acc + d.sizeBytes, 0),
    favoritesCount: documents.value.filter(d => d.isFavorite).length,
  }))

  const filtersModule = useDocumentFilters(documents, foldersModule.currentFolderId)

  // Перенаправляем фильтры в foldersModule для точного расчета видимых папок
  const visibleFolders = computed(() => {
    if (
      filtersModule.searchQuery.value.trim()
      || filtersModule.selectedCategory.value !== 'all'
      || filtersModule.onlyFavorites.value
    ) {
      return []
    }

    return foldersModule.folders.value.filter(f => (f.parentId ?? null) === foldersModule.currentFolderId.value)
  })

  const selectionModule = useDocumentSelection(
    documents,
    foldersModule.folders,
    filtersModule.filteredDocuments,
    updateDocument,
  )

  const uploadModule = useDocumentUpload(
    props.section.tripId,
    props.readonly,
    documents,
    updateDocument,
  )

  return {
    // Документы и общее состояние
    documents,
    isFetching,
    totalStats,
    loadDocuments,
    updateDocument,
    deleteDocument,
    toggleFavorite,
    moveDocument,

    // Папки
    folders: foldersModule.folders,
    currentFolderId: foldersModule.currentFolderId,
    currentFolder: foldersModule.currentFolder,
    breadcrumbs: foldersModule.breadcrumbs,
    folderStats: foldersModule.folderStats,
    visibleFolders,
    isAddingFolder: foldersModule.isAddingFolder,
    addFolder: foldersModule.addFolder,
    deleteFolder: foldersModule.deleteFolder,
    updateFolder: foldersModule.updateFolder,
    renameFolder: foldersModule.renameFolder,
    setCurrentFolder: foldersModule.setCurrentFolder,

    // Фильтры, поиск, сортировка
    searchQuery: filtersModule.searchQuery,
    selectedCategory: filtersModule.selectedCategory,
    onlyFavorites: filtersModule.onlyFavorites,
    sortOption: filtersModule.sortOption,
    viewMode: filtersModule.viewMode,
    sortOptions: filtersModule.sortOptions,
    currentSortLabel: filtersModule.currentSortLabel,
    categoryCounts: filtersModule.categoryCounts,
    filteredDocuments: filtersModule.filteredDocuments,
    resetFilters: filtersModule.resetFilters,

    // Мультивыбор
    selectedDocIds: selectionModule.selectedDocIds,
    isSelectionMode: selectionModule.isSelectionMode,
    toggleDocSelection: selectionModule.toggleDocSelection,
    selectAll: selectionModule.selectAll,
    clearSelection: selectionModule.clearSelection,
    exitSelectionMode: selectionModule.exitSelectionMode,
    deleteSelectedDocs: () => props.readonly ? Promise.resolve() : selectionModule.deleteSelectedDocs(),
    moveSelectedDocs: (id: string | null) => props.readonly ? Promise.resolve() : selectionModule.moveSelectedDocs(id),

    // Загрузка
    isUploading: uploadModule.isUploading,
    uploadProgress: uploadModule.uploadProgress,
    uploadFiles: uploadModule.uploadFiles,
  }
}
