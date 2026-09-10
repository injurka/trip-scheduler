import type {
  DocumentCategory,
  DocumentFile,
  DocumentsSectionContent,
} from '../models/types'
import type { TripDocumentResponse } from '~/shared/services/api/model/types'
import { computed, onMounted, ref } from 'vue'
import { useRequest } from '~/plugins/request'
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

export function useDocumentsSection(
  props: UseDocumentsSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
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
    }
  }

  async function loadDocuments() {
    isFetching.value = true
    await useRequest({
      key: `documents:list:${props.section.tripId}`,
      fn: api => api.files.listDocuments(props.section.tripId),
      onSuccess: (res) => {
        if ((!res || res.length === 0) && offlineStore.isTripCached(props.section.tripId)) {
          const cachedDocs = offlineStore.getSavedTripDocuments(props.section.tripId)
          if (cachedDocs && cachedDocs.length > 0) {
            documents.value = cachedDocs.map(mapResponseToDoc)
            return
          }
        }
        documents.value = res.map(mapResponseToDoc)
      },
      onError: () => {
        const cachedDocs = offlineStore.getSavedTripDocuments(props.section.tripId)
        if (cachedDocs && cachedDocs.length > 0) {
          documents.value = cachedDocs.map(mapResponseToDoc)
          toast.info('Нет подключения к сети. Загружены офлайн-документы.')
          return
        }
        toast.error('Не удалось загрузить документы')
      },
    })
    isFetching.value = false
  }

  onMounted(() => loadDocuments())

  // Базовые операции над отдельными документами
  async function updateDocument(updatedDoc: DocumentFile) {
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
    if (doc.folderId === targetFolderId)
      return
    await updateDocument({
      ...doc,
      folderId: targetFolderId,
    })
    const targetName = targetFolderId ? foldersModule.folders.value.find(f => f.id === targetFolderId)?.name : 'Корень'
    toast.success(`Перемещено в «${targetName || 'Все документы'}»`)
  }

  // Общая статистика
  const totalStats = computed(() => ({
    count: documents.value.length,
    sizeBytes: documents.value.reduce((acc, d) => acc + d.sizeBytes, 0),
    favoritesCount: documents.value.filter(d => d.isFavorite).length,
  }))

  const filtersModule = useDocumentFilters(
    documents,
    foldersModule.currentFolderId,
  )

  // Перенаправляем фильтры в foldersModule для точного расчета видимых папок
  const visibleFolders = computed(() => {
    if (foldersModule.currentFolderId.value)
      return []
    if (
      filtersModule.searchQuery.value.trim()
      || filtersModule.selectedCategory.value !== 'all'
      || filtersModule.onlyFavorites.value
    ) {
      return []
    }
    return foldersModule.folders.value
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
    deleteSelectedDocs: selectionModule.deleteSelectedDocs,
    moveSelectedDocs: selectionModule.moveSelectedDocs,

    // Загрузка
    isUploading: uploadModule.isUploading,
    uploadProgress: uploadModule.uploadProgress,
    uploadFiles: uploadModule.uploadFiles,
  }
}
