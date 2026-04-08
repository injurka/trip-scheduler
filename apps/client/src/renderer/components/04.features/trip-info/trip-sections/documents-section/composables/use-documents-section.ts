import type { DocumentFile, DocumentFolder, DocumentsSectionContent } from '../models/types'
import type { TripDocumentResponse } from '~/shared/services/api/model/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { useRequest } from '~/plugins/request'

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

  const documents = ref<DocumentFile[]>([])
  const folders = ref<DocumentFolder[]>(JSON.parse(JSON.stringify(props.section.content?.folders || [])))

  const currentFolderId = ref<string | null>(null)
  const isUploading = ref(false)
  const isFetching = ref(false)

  async function loadDocuments() {
    isFetching.value = true
    await useRequest({
      key: `documents:list:${props.section.tripId}`,
      fn: api => api.files.listDocuments(props.section.tripId),
      onSuccess: (res) => {
        documents.value = res.map(d => ({
          id: d.id,
          url: d.url,
          originalName: d.originalName,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt,
          access: d.metadata.access,
          folderId: d.metadata.folderId,
        }))
      },
      onError: () => {
        toast.error('Не удалось загрузить документы')
      },
    })
    isFetching.value = false
  }

  onMounted(() => loadDocuments())

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: {
        folders: folders.value,
      },
    })
  }, 700)

  const breadcrumbs = computed(() => {
    const crumbs = [{ id: null as string | null, name: 'Все документы' }]

    if (currentFolderId.value) {
      const folder = folders.value.find(f => f.id === currentFolderId.value)
      if (folder) {
        crumbs.push({ id: folder.id, name: folder.name })
      }
    }
    return crumbs
  })

  const visibleFolders = computed(() => currentFolderId.value ? [] : folders.value)
  const visibleDocuments = computed(() => documents.value.filter(d => d.folderId === currentFolderId.value))

  async function addFolder(name: string) {
    if (props.readonly || !name.trim())
      return
    folders.value.unshift({ id: uuidv4(), name: name.trim() })
  }

  async function deleteFolder(folderId: string) {
    const isConfirmed = await confirm({
      title: 'Удалить папку?',
      description: 'Все документы внутри папки будут перемещены в корень. Это действие необратимо.',
      type: 'danger',
    })
    if (isConfirmed) {
      folders.value = folders.value.filter(f => f.id !== folderId)

      const docsToUpdate = documents.value.filter(d => d.folderId === folderId)
      docsToUpdate.forEach(d => updateDocument({ ...d, folderId: null }))
    }
  }

  function updateFolder(folder: DocumentFolder) {
    const index = folders.value.findIndex(f => f.id === folder.id)
    if (index !== -1)
      folders.value[index] = folder
  }

  async function uploadFiles(files: File[], folderId: string | null, access: 'public' | 'private') {
    if (props.readonly || files.length === 0)
      return

    isUploading.value = true
    try {
      const uploadedDocs = await Promise.all(files.map(file =>
        useRequest({
          key: `documents:upload:${Date.now()}`,
          cancelPrevious: false,
          fn: api => api.files.uploadFile(file, props.section.tripId, 'trip', 'documents', null, null, { access, folderId }),
        }),
      )) as (TripDocumentResponse | null)[]

      uploadedDocs.forEach((res) => {
        if (res) {
          documents.value.unshift({
            id: res.id,
            url: res.url,
            originalName: res.originalName,
            sizeBytes: res.sizeBytes,
            createdAt: res.createdAt,
            access: res.metadata?.access || access,
            folderId: res.metadata?.folderId || folderId,
          })
        }
      })
      toast.success(`Успешно загружено ${files.length} файла(ов).`)
    }
    finally {
      isUploading.value = false
    }
  }

  async function deleteDocument(docId: string) {
    const isConfirmed = await confirm({
      title: 'Удалить документ?',
      description: 'Действие необратимо.',
      type: 'danger',
    })

    if (isConfirmed) {
      await useRequest({
        key: `documents:delete:${docId}`,
        fn: api => api.files.deleteFile(docId),
        onSuccess: () => {
          documents.value = documents.value.filter(d => d.id !== docId)
          toast.success('Удалено')
        },
        onError: () => toast.error('Ошибка удаления'),
      })
    }
  }

  async function updateDocument(doc: DocumentFile) {
    const index = documents.value.findIndex(d => d.id === doc.id)
    if (index !== -1) {
      documents.value[index] = doc
    }

    await useRequest({
      key: `documents:update:${doc.id}`,
      fn: api => api.files.updateDocumentMeta(doc.id, { access: doc.access, folderId: doc.folderId }),
    })
  }

  function setCurrentFolder(folderId: string | null) {
    currentFolderId.value = folderId
  }

  watch(folders, debouncedUpdate, { deep: true })

  return {
    documents,
    folders,
    currentFolderId,
    isUploading,
    isFetching,
    breadcrumbs,
    visibleFolders,
    visibleDocuments,
    addFolder,
    deleteFolder,
    updateFolder,
    uploadFiles,
    deleteDocument,
    updateDocument,
    setCurrentFolder,
  }
}
